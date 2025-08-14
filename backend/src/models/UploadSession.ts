import pool from "../database/connection";
import cacheService from "../services/cacheService";

export interface UploadSession {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  uploaded_chunks: number[];
  status: "pending" | "uploading" | "completed" | "failed";
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    mime_type?: string;
  };
}

export interface CreateUploadSessionData {
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    mime_type?: string;
  };
}

export class UploadSessionModel {
  static async create(data: CreateUploadSessionData): Promise<UploadSession> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const query = `
      INSERT INTO upload_sessions (
        user_id, filename, original_filename, file_size, chunk_size, 
        total_chunks, uploaded_chunks, status, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      data.user_id,
      data.filename,
      data.original_filename,
      data.file_size,
      data.chunk_size,
      data.total_chunks,
      JSON.stringify([]),
      "pending",
      expiresAt,
      JSON.stringify(data.metadata || {})
    ];

    const result = await pool.query(query, values);
    const session = result.rows[0];
    console.log("[DEBUG] ~ session:", session);

    return {
      ...session,
      uploaded_chunks: session.uploaded_chunks,
      metadata: session.metadata
    };
  }

  static async findById(id: string): Promise<UploadSession | null> {
    const query = "SELECT * FROM upload_sessions WHERE id = $1";
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    return {
      ...session,
      uploaded_chunks: session.uploaded_chunks,
      metadata: session.metadata || {}
    };
  }

  private static async initializeRedisChunks(
    id: string,
    existingChunks: number[]
  ): Promise<void> {
    if (existingChunks.length === 0) return;

    const redisKey = `upload_chunks:${id}`;
    try {
      const chunkStrings = existingChunks.map(chunk => chunk.toString());
      await cacheService.sadd(redisKey, ...chunkStrings);
      await cacheService.expire(redisKey, 86400); // 24 hour expiry
    } catch (error) {
      console.error(
        `Error initializing Redis chunks for session ${id}:`,
        error
      );
    }
  }

  static async updateChunkUploaded(
    id: string,
    chunkIndex: number
  ): Promise<UploadSession | null> {
    const session = await this.findById(id);
    if (!session) return null;

    const redisKey = `upload_chunks:${id}`;

    try {
      await this.initializeRedisChunks(id, session.uploaded_chunks);

      await cacheService.sadd(redisKey, chunkIndex.toString());
      await cacheService.expire(redisKey, 86400); // 24 hour expiry
      const uploadedCount = await cacheService.scard(redisKey);
      const isCompleted = uploadedCount >= session.total_chunks;
      const status = isCompleted ? "completed" : "uploading";

      const uploadedChunksSet = await cacheService.smembers(redisKey);
      const uploadedChunks = uploadedChunksSet
        .map(chunk => parseInt(chunk))
        .sort((a, b) => a - b);

      const query = `
        UPDATE upload_sessions 
        SET uploaded_chunks = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await pool.query(query, [
        JSON.stringify(uploadedChunks),
        status,
        id
      ]);

      if (result.rows.length === 0) return null;

      if (isCompleted) {
        await cacheService.del(redisKey);
      }

      const updatedSession = result.rows[0];
      return {
        ...updatedSession,
        uploaded_chunks: updatedSession.uploaded_chunks,
        metadata: updatedSession.metadata || {}
      };
    } catch (redisError) {
      console.error(
        `Redis error for session ${id}, falling back to PostgreSQL:`,
        redisError
      );

      return await this.updateChunkUploadedFallback(id, chunkIndex);
    }
  }

  private static async updateChunkUploadedFallback(
    id: string,
    chunkIndex: number
  ): Promise<UploadSession | null> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const lockQuery = `
        SELECT * FROM upload_sessions 
        WHERE id = $1 
        FOR UPDATE
      `;

      const lockResult = await client.query(lockQuery, [id]);
      if (lockResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const session = {
        ...lockResult.rows[0],
        uploaded_chunks: lockResult.rows[0].uploaded_chunks,
        metadata: lockResult.rows[0].metadata || {}
      };

      const uploadedChunks = [...session.uploaded_chunks];
      if (!uploadedChunks.includes(chunkIndex)) {
        uploadedChunks.push(chunkIndex);
        uploadedChunks.sort((a, b) => a - b);
      }

      const status =
        uploadedChunks.length === session.total_chunks
          ? "completed"
          : "uploading";

      const updateQuery = `
        UPDATE upload_sessions 
        SET uploaded_chunks = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        JSON.stringify(uploadedChunks),
        status,
        id
      ]);

      await client.query("COMMIT");

      if (result.rows.length === 0) return null;

      const updatedSession = result.rows[0];
      return {
        ...updatedSession,
        uploaded_chunks: updatedSession.uploaded_chunks,
        metadata: updatedSession.metadata || {}
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateStatus(
    id: string,
    status: UploadSession["status"]
  ): Promise<UploadSession | null> {
    const query = `
      UPDATE upload_sessions 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) return null;

    const session = result.rows[0];
    return {
      ...session,
      uploaded_chunks: session.uploaded_chunks,
      metadata: session.metadata || {}
    };
  }

  static async delete(id: string): Promise<boolean> {
    const redisKey = `upload_chunks:${id}`;
    try {
      await cacheService.del(redisKey);
    } catch (error) {
      console.error(`Error cleaning up Redis key for session ${id}:`, error);
    }

    const query = "DELETE FROM upload_sessions WHERE id = $1";
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async findExpiredSessions(): Promise<UploadSession[]> {
    const query =
      "SELECT * FROM upload_sessions WHERE expires_at < CURRENT_TIMESTAMP";
    const result = await pool.query(query);

    const expiredSessions = result.rows.map((session: any) => ({
      ...session,
      uploaded_chunks: session.uploaded_chunks,
      metadata: session.metadata || {}
    }));

    if (expiredSessions.length > 0) {
      try {
        const redisKeys = expiredSessions.map(
          session => `upload_chunks:${session.id}`
        );
        for (const key of redisKeys) {
          await cacheService.del(key);
        }
        console.log(
          `Cleaned up ${redisKeys.length} Redis keys for expired sessions`
        );
      } catch (error) {
        console.error(
          "Error cleaning up Redis keys for expired sessions:",
          error
        );
      }
    }

    return expiredSessions;
  }

  static async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<UploadSession[]> {
    const query = `
      SELECT * FROM upload_sessions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);

    return result.rows.map((session: any) => ({
      ...session,
      uploaded_chunks: session.uploaded_chunks,
      metadata: session.metadata || {}
    }));
  }
}
