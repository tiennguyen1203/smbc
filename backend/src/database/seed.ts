import { Pool } from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedDatabase() {
  try {
    console.log("Starting database seeding...");

    const hashedPassword = await bcrypt.hash("password123", 10);

    const users = [
      {
        username: "admin",
        email: "admin@example.com",
        password_hash: hashedPassword
      },
      {
        username: "user1",
        email: "user1@example.com",
        password_hash: hashedPassword
      },
      {
        username: "user2",
        email: "user2@example.com",
        password_hash: hashedPassword
      }
    ];

    const userIds: string[] = [];
    for (const user of users) {
      const result = await pool.query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username RETURNING id",
        [user.username, user.email, user.password_hash]
      );
      userIds.push(result.rows[0].id);
    }

    console.log("Users created with IDs:", userIds);

    const videos = [
      {
        title: "Sample Video 1",
        description: "This is a sample video for testing",
        filename: "sample1.mp4",
        original_filename: "sample1.mp4",
        file_path: "/uploads/sample1.mp4",
        thumbnail_path: "/uploads/thumbnails/sample1.jpg",
        duration: 120,
        file_size: 1024000,
        mime_type: "video/mp4",
        status: "processed",
        user_id: userIds[0],
        category: "general"
      },
      {
        title: "Sample Video 2",
        description: "Another sample video for testing",
        filename: "sample2.mp4",
        original_filename: "sample2.mp4",
        file_path: "/uploads/sample2.mp4",
        thumbnail_path: "/uploads/thumbnails/sample2.jpg",
        duration: 180,
        file_size: 1536000,
        mime_type: "video/mp4",
        status: "processed",
        user_id: userIds[1],
        category: "general"
      }
    ];

    for (const video of videos) {
      await pool.query(
        "INSERT INTO videos (title, description, filename, original_filename, file_path, thumbnail_path, duration, file_size, mime_type, status, user_id, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING",
        [
          video.title,
          video.description,
          video.filename,
          video.original_filename,
          video.file_path,
          video.thumbnail_path,
          video.duration,
          video.file_size,
          video.mime_type,
          video.status,
          video.user_id,
          video.category
        ]
      );
    }

    const products = [
      {
        name: "Product 1",
        description: "Sample product for testing",
        price: 29.99,
        category: "electronics"
      },
      {
        name: "Product 2",
        description: "Another sample product",
        price: 49.99,
        category: "clothing"
      }
    ];

    for (const product of products) {
      await pool.query(
        "INSERT INTO products (name, description, price, category) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [product.name, product.description, product.price, product.category]
      );
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await pool.end();
  }
}

seedDatabase();
