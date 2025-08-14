import pool from "./connection";

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        thumbnail_path VARCHAR(500),
        duration INTEGER DEFAULT 0,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'processing',
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        tags TEXT[] DEFAULT '{}',
        category VARCHAR(100) DEFAULT 'general',
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        chunk_size INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        uploaded_chunks JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
      CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
      CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON upload_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at);
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION update_upload_sessions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_upload_sessions_updated_at ON upload_sessions;
      CREATE TRIGGER update_upload_sessions_updated_at
          BEFORE UPDATE ON upload_sessions
          FOR EACH ROW
          EXECUTE FUNCTION update_upload_sessions_updated_at();
    `);

    console.log("Database tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
};

const runMigrations = async () => {
  try {
    await createTables();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigrations();
