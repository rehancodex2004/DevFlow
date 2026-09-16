-- ============================================================
-- GLOBAL AI CHAT MEMORY
-- ============================================================
--
-- Same pattern as ai_task_messages, but scoped to just the user
-- (no task/project/organization) - this is the assistant reachable
-- from the sidebar / floating button / command palette that can
-- search and answer across everything that user is authorized to see.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_global_messages (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant')),

    content TEXT NOT NULL,

    sources JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_global_messages_user
    ON ai_global_messages(user_id, created_at);
