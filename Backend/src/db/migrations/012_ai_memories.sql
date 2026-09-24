CREATE TABLE IF NOT EXISTS ai_memories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('preference', 'decision', 'requirement', 'constraint', 'context', 'plan', 'fact')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  importance SMALLINT NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_memories_valid_scope CHECK (
    (task_id IS NULL OR project_id IS NOT NULL) AND
    (project_id IS NULL OR organization_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON ai_memories(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_scope ON ai_memories(organization_id, project_id, task_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_type ON ai_memories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding
  ON ai_memories USING hnsw (embedding vector_cosine_ops);
