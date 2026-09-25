CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS spaces (
    id serial PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS space_members (
    space_id int NOT NULL REFERENCES spaces ON DELETE CASCADE,
    user_id int NOT NULL REFERENCES users ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    PRIMARY KEY (space_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
    id serial PRIMARY KEY,
    space_id int NOT NULL REFERENCES spaces ON DELETE CASCADE,
    title text NOT NULL,
    body_md text NOT NULL DEFAULT '',
    source_type text NOT NULL DEFAULT 'markdown',
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id serial PRIMARY KEY,
    document_id int NOT NULL REFERENCES documents ON DELETE CASCADE,
    position int NOT NULL,
    text text NOT NULL,
    embedding vector(384) NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);

CREATE TABLE IF NOT EXISTS queries (
    id serial PRIMARY KEY,
    user_id int REFERENCES users ON DELETE SET NULL,
    text text NOT NULL,
    cited_chunk_ids int[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Document metadata for the editor: last editor and search-index status.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_by int REFERENCES users ON DELETE SET NULL;

-- One-time migration: runs only while index_status is absent, so restarts never re-backfill.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'documents' AND column_name = 'index_status'
    ) THEN
        ALTER TABLE documents
            ADD COLUMN index_status text NOT NULL DEFAULT 'pending'
                CHECK (index_status IN ('pending', 'indexed', 'failed')),
            ADD COLUMN indexed_at timestamptz;
        UPDATE documents SET index_status = 'indexed', indexed_at = updated_at
        WHERE body_md = '' OR EXISTS (SELECT 1 FROM chunks c WHERE c.document_id = documents.id);
    END IF;
END $$;
