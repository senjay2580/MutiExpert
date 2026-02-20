-- 会话管理与消息统计增强

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS prompt_tokens INT;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS completion_tokens INT;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS cost_usd DOUBLE PRECISION;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS latency_ms INT;
