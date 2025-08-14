import pool from "../database/connection";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
}

export class ProductModel {
  static async findAll(): Promise<Product[]> {
    const query = "SELECT * FROM products ORDER BY created_at DESC";
    const result = await pool.query(query);
    return result.rows;
  }

  static async findById(id: string): Promise<Product | null> {
    const query = "SELECT * FROM products WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByCategory(category: string): Promise<Product[]> {
    const query =
      "SELECT * FROM products WHERE category = $1 ORDER BY created_at DESC";
    const result = await pool.query(query, [category]);
    return result.rows;
  }

  static async create(data: CreateProductRequest): Promise<Product> {
    const query = `
      INSERT INTO products (name, description, price, category, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.name,
      data.description,
      data.price,
      data.category
    ]);
    return result.rows[0];
  }

  static async update(
    id: string,
    data: UpdateProductRequest
  ): Promise<Product | null> {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) return null;

    const setClause = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    const query = `
      UPDATE products 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);
    return result.rows[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    const query = "DELETE FROM products WHERE id = $1";
    const result = await pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
