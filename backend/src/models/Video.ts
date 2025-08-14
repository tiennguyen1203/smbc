import pool from "../database/connection";

export interface Video {
  id: string;
  title: string;
  description: string;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string;
  duration: number;
  file_size: number;
  mime_type: string;
  status: "processing" | "ready" | "failed";
  user_id: string;
  tags: string[];
  category: string;
  views: number;
  likes: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVideoData {
  title: string;
  description: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  user_id: string;
  tags?: string[];
  category?: string;
}

export interface UpdateVideoData {
  title?: string;
  description?: string;
  thumbnail_path?: string;
  duration?: number;
  status?: "processing" | "ready" | "failed";
  tags?: string[];
  category?: string;
}

export class VideoModel {
  static async create(data: CreateVideoData): Promise<Video> {
    const query = `
      INSERT INTO videos (
        title, description, filename, original_filename, file_path, 
        file_size, mime_type, user_id, tags, category, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'processing', NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.title,
      data.description,
      data.filename,
      data.original_filename,
      data.file_path,
      data.file_size,
      data.mime_type,
      data.user_id,
      data.tags || [],
      data.category || "general"
    ]);

    return result.rows[0];
  }

  static async findById(id: string): Promise<Video | null> {
    const query = "SELECT * FROM videos WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByUserId(userId: string): Promise<Video[]> {
    const query =
      "SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC";
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async findAll(limit = 20, offset = 0): Promise<Video[]> {
    const query =
      "SELECT * FROM videos WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3";
    const result = await pool.query(query, ["ready", limit, offset]);
    return result.rows;
  }

  static async search(query: string, limit = 20, offset = 0): Promise<Video[]> {
    const searchQuery = `
      SELECT * FROM videos 
      WHERE status = 'ready' 
      AND (title ILIKE $1 OR description ILIKE $1 OR tags::text ILIKE $1)
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(searchQuery, [`%${query}%`, limit, offset]);
    return result.rows;
  }

  static async update(
    id: string,
    data: UpdateVideoData
  ): Promise<Video | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) return null;

    const setClause = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    const query = `
      UPDATE videos 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  static async incrementViews(id: string): Promise<void> {
    const query = "UPDATE videos SET views = views + 1 WHERE id = $1";
    await pool.query(query, [id]);
  }

  static async incrementLikes(id: string): Promise<void> {
    const query = "UPDATE videos SET likes = likes + 1 WHERE id = $1";
    await pool.query(query, [id]);
  }

  static async delete(id: string): Promise<boolean> {
    const query = "DELETE FROM videos WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
