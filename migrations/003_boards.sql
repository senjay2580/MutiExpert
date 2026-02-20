-- MutiExpert Migration 003: Canvas Boards
-- Depends on: 002_todos_and_site_settings.sql

CREATE TABLE IF NOT EXISTS boards (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    thumbnail_url TEXT,
    nodes         JSONB DEFAULT '[]',
    edges         JSONB DEFAULT '[]',
    viewport      JSONB DEFAULT '{"x":0,"y":0,"zoom":1}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_updated ON boards(updated_at DESC);
