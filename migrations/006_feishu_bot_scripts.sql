-- 006: 飞书智能机器人 + 用户脚本 + Bot Tools

-- 1. 用户脚本表
CREATE TABLE IF NOT EXISTS user_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    script_content TEXT NOT NULL,
    script_type VARCHAR(20) DEFAULT 'typescript',
    created_by VARCHAR(100) DEFAULT 'web',
    last_test_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),
    last_test_output TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 飞书待确认操作表
CREATE TABLE IF NOT EXISTS feishu_pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR(100) NOT NULL,
    message_id VARCHAR(100),
    action_type VARCHAR(50) NOT NULL,
    action_payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON feishu_pending_actions(status, expires_at);

-- 3. Bot Tools 表（AI 能力注册，可动态增删）
CREATE TABLE IF NOT EXISTS bot_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    action_type VARCHAR(20) NOT NULL DEFAULT 'query',
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    param_mapping JSONB DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. feishu_config 加 default_provider
ALTER TABLE feishu_config ADD COLUMN IF NOT EXISTS default_provider VARCHAR(50) DEFAULT 'claude';

-- 5. scheduled_tasks 加 script_id
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS script_id UUID REFERENCES user_scripts(id) ON DELETE SET NULL;
