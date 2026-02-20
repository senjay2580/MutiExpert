-- MutiExpert Migration 002: Todos + Site Settings
-- Depends on: 001_initial_schema.sql

-- 待办任务
CREATE TABLE todos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(500) NOT NULL,
    completed   BOOLEAN DEFAULT FALSE,
    priority    VARCHAR(10) DEFAULT 'medium',
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 站点设置 (key-value)
CREATE TABLE site_settings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key         VARCHAR(100) UNIQUE NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认站点设置
INSERT INTO site_settings (key, value) VALUES
    ('siteName', 'MutiExpert'),
    ('siteSubtitle', '知识管理平台'),
    ('logoUrl', '/logo.svg'),
    ('navIcons', '{"dashboard":"streamline-color:dashboard-3","knowledge":"streamline-color:open-book","scheduler":"streamline-color:circle-clock","settings":"streamline-color:cog","aiModels":"streamline-color:computer-chip-1","integrations":"streamline-color:electric-cord-1","data":"streamline-color:database"}');
