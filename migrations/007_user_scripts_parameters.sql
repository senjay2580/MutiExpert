-- 007_user_scripts_parameters.sql
-- 给 user_scripts 加参数定义 + AI 工具暴露开关。

ALTER TABLE user_scripts
    ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_scripts
    ADD COLUMN IF NOT EXISTS expose_as_tool BOOLEAN NOT NULL DEFAULT FALSE;

-- 简易部分索引：只对暴露为工具的脚本建索引，提升 pipeline _collect_tools 查询速度
CREATE INDEX IF NOT EXISTS idx_user_scripts_expose_as_tool
    ON user_scripts (expose_as_tool)
    WHERE expose_as_tool = TRUE AND enabled = TRUE;
