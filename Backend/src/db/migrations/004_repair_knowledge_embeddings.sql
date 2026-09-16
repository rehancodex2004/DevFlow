-- ============================================================
-- REPAIR: knowledge_embeddings ALREADY EXISTED
-- ============================================================
--
-- Migration 003 used `CREATE TABLE IF NOT EXISTS knowledge_embeddings`.
-- On at least one machine, a table with that name already existed
-- (from an earlier partial/manual attempt) with fewer columns, so
-- Postgres silently skipped creating the new version and left the
-- old, incomplete table in place. That caused:
--
--   column "content_hash" does not exist
--
-- This migration patches whatever version of the table already
-- exists, instead of assuming it is fresh. It is safe to run
-- multiple times and safe to run even if 003 worked correctly
-- (every statement below is a conditional no-op in that case).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add any columns that might be missing.
-- ------------------------------------------------------------

ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS project_id BIGINT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS task_id BIGINT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS comment_id BIGINT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS source_type VARCHAR(30);
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS source_id BIGINT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE knowledge_embeddings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ------------------------------------------------------------
-- 2. Remove any duplicate rows that would violate the unique
--    constraint we're about to add (leftover from earlier
--    failed/partial indexing attempts, if any).
-- ------------------------------------------------------------

DELETE FROM knowledge_embeddings a
USING knowledge_embeddings b
WHERE a.id < b.id
  AND a.source_type = b.source_type
  AND a.source_id = b.source_id
  AND a.chunk_index = b.chunk_index;

-- ------------------------------------------------------------
-- 3. Backfill content_hash for any existing rows so the
--    idempotent-upsert check in knowledgeBaseService.js works
--    correctly on the very next index run.
-- ------------------------------------------------------------

UPDATE knowledge_embeddings
SET content_hash = encode(sha256(convert_to(content, 'UTF8')), 'hex')
WHERE content_hash IS NULL
  AND content IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Add the unique constraint used by ON CONFLICT upserts,
--    only if it doesn't already exist.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_knowledge_source'
  ) THEN
    ALTER TABLE knowledge_embeddings
      ADD CONSTRAINT unique_knowledge_source
      UNIQUE (source_type, source_id, chunk_index);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Make sure all indexes exist.
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_knowledge_organization ON knowledge_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_task ON knowledge_embeddings(task_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops);

DROP TRIGGER IF EXISTS knowledge_embeddings_updated_at_trigger ON knowledge_embeddings;
CREATE TRIGGER knowledge_embeddings_updated_at_trigger
BEFORE UPDATE ON knowledge_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
