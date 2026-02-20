/**
 * Storyset (by Freepik) 行业矢量插图映射
 * 风格: Pana — 扁平 + 手绘元素
 * 许可: Free for personal and commercial use with attribution
 * 来源: https://storyset.com/
 */

/** 行业关键词 → 插图文件名映射 */
const industryKeywords: Record<string, string> = {
  // 中文关键词
  医疗: 'medical',
  医药: 'medical',
  健康: 'medical',
  医院: 'medical',
  科学: 'medical',
  金融: 'finance',
  银行: 'finance',
  投资: 'finance',
  保险: 'finance',
  证券: 'finance',
  教育: 'learning',
  培训: 'learning',
  学校: 'learning',
  学习: 'learning',
  科技: 'technology',
  技术: 'technology',
  软件: 'technology',
  编程: 'technology',
  互联网: 'technology',
  IT: 'technology',
  AI: 'innovation',
  人工智能: 'innovation',
  创新: 'innovation',
  数据: 'data',
  分析: 'analytics',
  商业: 'business',
  企业: 'business',
  管理: 'business',
  运营: 'business',
  营销: 'business',
  // 英文关键词
  medical: 'medical',
  health: 'medical',
  finance: 'finance',
  banking: 'finance',
  education: 'learning',
  learning: 'learning',
  technology: 'technology',
  tech: 'technology',
  innovation: 'innovation',
  data: 'data',
  analytics: 'analytics',
  business: 'business',
};

const ILLUSTRATION_BASE = '/illustrations/storyset';

/** 所有可用的插图文件 */
export const illustrations = {
  bookLover: `${ILLUSTRATION_BASE}/book-lover.svg`,
  noData: `${ILLUSTRATION_BASE}/no-data.svg`,
  learning: `${ILLUSTRATION_BASE}/learning.svg`,
  business: `${ILLUSTRATION_BASE}/business.svg`,
  medical: `${ILLUSTRATION_BASE}/medical.svg`,
  finance: `${ILLUSTRATION_BASE}/finance.svg`,
  technology: `${ILLUSTRATION_BASE}/technology.svg`,
  innovation: `${ILLUSTRATION_BASE}/innovation.svg`,
  analytics: `${ILLUSTRATION_BASE}/analytics.svg`,
  data: `${ILLUSTRATION_BASE}/data.svg`,
  schedule: `${ILLUSTRATION_BASE}/schedule.svg`,
  aiChat: `${ILLUSTRATION_BASE}/ai-chat.svg`,
  network: `${ILLUSTRATION_BASE}/network.svg`,
} as const;

/** 根据行业名称匹配对应的插图路径 */
export function getIndustryIllustration(industryName: string): string {
  const name = industryName.toLowerCase();

  for (const [keyword, illustration] of Object.entries(industryKeywords)) {
    if (name.includes(keyword.toLowerCase())) {
      return `${ILLUSTRATION_BASE}/${illustration}.svg`;
    }
  }

  // 默认使用 book-lover
  return illustrations.bookLover;
}

/** 预定义的插图集合，方便按用途取用 */
export const illustrationPresets = {
  /** 知识库页面顶部 Hero */
  knowledgeHero: illustrations.bookLover,
  /** 空知识库状态 */
  emptyKnowledge: illustrations.noData,
  /** 空文档状态 */
  emptyDocuments: illustrations.noData,
  /** 空定时任务状态 */
  emptySchedule: illustrations.schedule,
  /** 空 AI 模型状态 */
  emptyAIModels: illustrations.aiChat,
  /** 空知识图谱状态 */
  emptyGraph: illustrations.network,
  /** 空画板状态 */
  emptyBoards: illustrations.innovation,
} as const;
