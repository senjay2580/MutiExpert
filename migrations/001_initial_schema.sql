-- MutiExpert Initial Schema
-- Requires: uuid-ossp, vector extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 行业分类
CREATE TABLE industries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon        VARCHAR(50),
    color       VARCHAR(7),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 知识库
CREATE TABLE knowledge_bases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    industry_id     UUID REFERENCES industries(id) ON DELETE SET NULL,
    document_count  INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 文档
CREATE TABLE documents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title             VARCHAR(500) NOT NULL,
    file_type         VARCHAR(20) NOT NULL,
    file_url          TEXT,
    file_size         BIGINT,
    content_text      TEXT,
    chunk_count       INT DEFAULT 0,
    status            VARCHAR(20) DEFAULT 'uploading',
    error_message     TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 文档分块 + 向量
CREATE TABLE document_chunks (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    chunk_index       INT NOT NULL,
    content           TEXT NOT NULL,
    embedding         VECTOR(1024),
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 对话
CREATE TABLE conversations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title             VARCHAR(500),
    knowledge_base_ids UUID[] DEFAULT '{}',
    model_provider    VARCHAR(20) DEFAULT 'claude',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 消息
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    sources         JSONB DEFAULT '[]',
    model_used      VARCHAR(50),
    tokens_used     INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 知识关联（网络图边）
CREATE TABLE knowledge_links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    target_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    source_kb_id    UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    target_kb_id    UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    relation_type   VARCHAR(50),
    strength        FLOAT CHECK (strength >= 0 AND strength <= 1),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 创意洞察
CREATE TABLE insights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(500) NOT NULL,
    content         TEXT NOT NULL,
    related_kb_ids  UUID[] DEFAULT '{}',
    related_link_ids UUID[] DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'new',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 技能配置
CREATE TABLE skills (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(20) NOT NULL,
    config      JSONB DEFAULT '{}',
    file_path   TEXT,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 日历事件
CREATE TABLE calendar_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    event_type      VARCHAR(50),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    related_kb_id   UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    feishu_event_id VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 飞书配置
CREATE TABLE feishu_config (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id              VARCHAR(200),
    app_secret_encrypted TEXT,
    webhook_url         TEXT,
    bot_enabled         BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ========== 索引 ==========

CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_kb_id ON document_chunks(knowledge_base_id);
CREATE INDEX idx_documents_kb_id ON documents(knowledge_base_id);
CREATE INDEX idx_messages_conv_time ON messages(conversation_id, created_at);
CREATE INDEX idx_links_source_target ON knowledge_links(source_kb_id, target_kb_id);
CREATE INDEX idx_calendar_time ON calendar_events(start_time, end_time);

