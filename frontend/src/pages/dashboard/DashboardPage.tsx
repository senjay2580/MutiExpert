import { Card, Col, Row, Statistic, List, Tag, Empty } from 'antd';
import { BookOutlined, FileTextOutlined, MessageOutlined, BulbOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardService } from '../../services/dashboardService';

const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b'];

const statCards = [
  { key: 'total_knowledge_bases', title: '知识库', icon: <BookOutlined style={{ fontSize: 28, color: '#6366f1' }} />, cls: 'stat-card-1' },
  { key: 'total_documents', title: '文档', icon: <FileTextOutlined style={{ fontSize: 28, color: '#0ea5e9' }} />, cls: 'stat-card-2' },
  { key: 'total_conversations', title: '对话', icon: <MessageOutlined style={{ fontSize: 28, color: '#10b981' }} />, cls: 'stat-card-3' },
  { key: 'total_insights', title: '创意洞察', icon: <BulbOutlined style={{ fontSize: 28, color: '#f59e0b' }} />, cls: 'stat-card-4' },
];

export default function DashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });
  const { data: aiUsage } = useQuery({
    queryKey: ['dashboard-ai-usage'],
    queryFn: dashboardService.getAIUsage,
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ['dashboard-timeline'],
    queryFn: dashboardService.getActivityTimeline,
  });
  const { data: heatmap = [] } = useQuery({
    queryKey: ['dashboard-heatmap'],
    queryFn: dashboardService.getKnowledgeHeatmap,
  });

  const pieData = aiUsage ? [
    { name: 'Claude', value: aiUsage.claude_calls },
    { name: 'Codex', value: aiUsage.openai_calls },
  ].filter((d) => d.value > 0) : [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-header" style={{ margin: 0 }}>仪表盘</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>多行业知识资产概览</p>
      </div>
      <Row gutter={[16, 16]}>
        {statCards.map((sc) => (
          <Col xs={24} sm={12} lg={6} key={sc.key}>
            <Card className={sc.cls} style={{ borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  {sc.icon}
                </div>
                <Statistic
                  title={sc.title}
                  value={(overview as Record<string, number>)?.[sc.key] ?? 0}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="知识库文档分布" style={{ borderRadius: 16 }}>
            {heatmap.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={heatmap} barCategoryGap="20%">
                  <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="AI 使用统计" style={{ borderRadius: 16 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={90} innerRadius={50} paddingAngle={4} label
                    strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无使用数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="最近活动" style={{ borderRadius: 16 }}>
            <List
              dataSource={timeline}
              locale={{ emptyText: <Empty description="暂无活动记录" /> }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Tag color={item.type === 'document' ? 'purple' : 'cyan'}
                          style={{ borderRadius: 6 }}>
                          {item.type === 'document' ? '文档' : '对话'}
                        </Tag>
                        {item.title}
                      </span>
                    }
                    description={new Date(item.time).toLocaleString()}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
