import pool from "../database/connection";

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
}

export class UserModel {
  static async create(data: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, username, email, password_hash as password, 
                created_at as "createdAt", updated_at as "updatedAt"
    `;

    const result = await pool.query(query, [
      data.username,
      data.email,
      data.password
    ]);
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash as password, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE email = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash as password, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE username = $1
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, password_hash as password, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findAll(): Promise<User[]> {
    const query = `
      SELECT id, username, email, password_hash as password, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  static async update(
    id: string,
    data: Partial<Omit<User, "id" | "created_at">>
  ): Promise<User | null> {
    const fields = Object.keys(data).filter(
      key => key !== "id" && key !== "created_at"
    );
    const values = Object.values(data).filter(
      (_, index) => fields[index] !== "id" && fields[index] !== "created_at"
    );

    if (fields.length === 0) return null;

    const setClause = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = "DELETE FROM users WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
