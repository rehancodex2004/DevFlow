-- ============================================================
-- AI CHAT SESSIONS
-- ============================================================
--
-- One session represents one conversation.
-- A session can belong to Task AI or Global AI.
-- When the user clicks "End Chat", the session becomes ENDED.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    -- TASK or GLOBAL
    chat_type VARCHAR(20) NOT NULL
        CHECK (chat_type IN ('TASK', 'GLOBAL')),

    -- Used only for Task AI
    task_id BIGINT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,

    -- ACTIVE = currently chatting
    -- ENDED  = user ended the conversation
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'ENDED')),

    -- Small title for Recent Chats
    title TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    ended_at TIMESTAMPTZ NULL
);

-- Quickly find user's sessions
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user
    ON ai_chat_sessions(user_id, created_at DESC);

-- Quickly find Task AI sessions
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_task
    ON ai_chat_sessions(task_id, user_id, created_at DESC);

-- Quickly find active sessions
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_active
    ON ai_chat_sessions(user_id, status);