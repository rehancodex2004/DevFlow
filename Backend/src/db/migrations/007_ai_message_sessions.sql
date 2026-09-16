-- ============================================================
-- CONNECT AI MESSAGES TO CHAT SESSIONS
-- ============================================================

-- Task AI messages
ALTER TABLE ai_task_messages
ADD COLUMN IF NOT EXISTS session_id BIGINT NULL
REFERENCES ai_chat_sessions(id) ON DELETE CASCADE;

-- Global AI messages
ALTER TABLE ai_global_messages
ADD COLUMN IF NOT EXISTS session_id BIGINT NULL
REFERENCES ai_chat_sessions(id) ON DELETE CASCADE;


-- Indexes for loading messages of one session
CREATE INDEX IF NOT EXISTS idx_ai_task_messages_session
    ON ai_task_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_global_messages_session
    ON ai_global_messages(session_id, created_at);