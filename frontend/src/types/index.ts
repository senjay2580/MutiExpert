export interface Industry {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  industry_id: string;
  industry?: Industry;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  knowledge_base_id: string;
  title: string;
  file_type: 'pdf' | 'docx' | 'md' | 'link' | 'article';
  file_url: string;
  file_size: number;
  source_url?: string;
  content_html?: string;
  content_text: string;
  chunk_count: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export type ModelProvider = 'claude' | 'openai' | 'codex' | 'deepseek' | 'qwen';

export interface Conversation {
  id: string;
  title: string;
  knowledge_base_ids: string[];
  model_provider: ModelProvider;
  is_pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: SourceReference[];
  model_used: string | null;
  tokens_used: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface SourceReference {
  chunk_id: string;
  document_id: string;
  document_title: string;
  snippet: string;
  score: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  industry: string;
  color: string;
  document_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  relation_type: string;
  description: string;
}

export interface Insight {
  id: string;
  title: string;
  content: string;
  related_kb_ids: string[];
  status: 'new' | 'reviewed' | 'archived' | 'pushed_to_feishu';
  created_at: string;
}

export interface DashboardOverview {
  total_knowledge_bases: number;
  total_documents: number;
  total_conversations: number;
  total_insights: number;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string | null;
  cron_expression: string;
  task_type: 'skill_exec' | 'ai_query' | 'feishu_push';
  task_config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}
