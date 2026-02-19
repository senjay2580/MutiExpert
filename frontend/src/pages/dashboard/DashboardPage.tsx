import { Card, Col, Row, Statistic, List, Tag, Empty } from 'antd';
import { BookOutlined, FileTextOutlined, MessageOutlined, BulbOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardService } from '../../services/dashboardService';

const PIE_COLORS = ['#3B82F6', '#10B981'];

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
      <h2 className="text-xl font-semibold mb-4">仪表盘</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="知识库" value={overview?.total_knowledge_bases ?? 0} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="文档" value={overview?.total_documents ?? 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="对话" value={overview?.total_conversations ?? 0} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic title="创意洞察" value={overview?.total_insights ?? 0} prefix={<BulbOutlined />} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="知识库文档分布">
            {heatmap.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={heatmap}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="AI 使用统计">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无使用数据" />}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24}>
          <Card title="最近活动">
            <List
              dataSource={timeline}
              locale={{ emptyText: <Empty description="暂无活动记录" /> }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<span><Tag color={item.type === 'document' ? 'blue' : 'green'}>{item.type === 'document' ? '文档' : '对话'}</Tag>{item.title}</span>}
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
