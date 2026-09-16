-- ============================================================
-- CMS AI KNOWLEDGE BASE
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE IF NOT EXISTS knowledge_base (
    id BIGSERIAL PRIMARY KEY,

    -- What type of CMS data is stored
    -- organization / project / task / comment
    entity_type VARCHAR(50) NOT NULL,

    -- ID of the original CMS record
    entity_id BIGINT NOT NULL,

    -- Organization this knowledge belongs to
    organization_id BIGINT,

    -- Project this knowledge belongs to
    project_id BIGINT,

    -- Original text used to create embedding
    content TEXT NOT NULL,

    -- Vector embedding
    embedding VECTOR(1536),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_knowledge_base_entity
ON knowledge_base(entity_type, entity_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_base_organization
ON knowledge_base(organization_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_base_project
ON knowledge_base(project_id);


CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
ON knowledge_base
USING hnsw (embedding vector_cosine_ops);