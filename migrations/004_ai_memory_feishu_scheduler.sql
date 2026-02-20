-- AI 记忆与飞书/调度增强

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS memory_summary TEXT;

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE feishu_config
    ADD COLUMN IF NOT EXISTS verification_token VARCHAR(200);

ALTER TABLE feishu_config
    ADD COLUMN IF NOT EXISTS encrypt_key VARCHAR(200);

ALTER TABLE feishu_config
    ADD COLUMN IF NOT EXISTS default_chat_id VARCHAR(200);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    task_type       VARCHAR(50) NOT NULL,
    task_config     JSONB DEFAULT '{}'::jsonb,
    enabled         BOOLEAN DEFAULT TRUE,
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
