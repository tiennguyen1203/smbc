import pool from "../database/connection";

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  video_id: string;
  parent_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCommentData {
  content: string;
  user_id: string;
  video_id: string;
  parent_id?: string;
}

export interface UpdateCommentData {
  content: string;
}

export class CommentModel {
  static async create(data: CreateCommentData): Promise<Comment> {
    const query = `
      INSERT INTO comments (content, user_id, video_id, parent_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      data.content,
      data.user_id,
      data.video_id,
      data.parent_id
    ]);

    return result.rows[0];
  }

  static async findById(id: string): Promise<Comment | null> {
    const query = "SELECT * FROM comments WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByVideoId(
    videoId: string,
    limit = 50,
    offset = 0
  ): Promise<Comment[]> {
    const query = `
      SELECT c.*, u.username 
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.video_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [videoId, limit, offset]);
    return result.rows;
  }

  static async findByUserId(userId: string): Promise<Comment[]> {
    const query =
      "SELECT * FROM comments WHERE user_id = $1 ORDER BY created_at DESC";
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async update(
    id: string,
    data: UpdateCommentData
  ): Promise<Comment | null> {
    const query = `
      UPDATE comments 
      SET content = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, data.content]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = "DELETE FROM comments WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
