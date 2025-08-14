-- Create upload_sessions table for chunked uploads
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
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions (status);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON upload_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions (created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_upload_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_upload_sessions_updated_at
    BEFORE UPDATE ON upload_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_upload_sessions_updated_at();