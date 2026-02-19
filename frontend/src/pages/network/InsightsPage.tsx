import { Card, Empty, List, Tag, Button, message } from 'antd';
import { BulbOutlined, SendOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { networkService } from '../../services/networkService';
import type { Insight } from '../../types';

const statusMap: Record<string, { color: string; text: string }> = {
  new: { color: 'blue', text: '新洞察' },
  reviewed: { color: 'green', text: '已查看' },
  archived: { color: 'default', text: '已归档' },
  pushed_to_feishu: { color: 'purple', text: '已推送飞书' },
};

export default function InsightsPage() {
  const queryClient = useQueryClient();

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights'],
    queryFn: networkService.listInsights,
  });

  const pushMutation = useMutation({
    mutationFn: networkService.pushToFeishu,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      message.success('已推送到飞书');
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">创意洞察</h2>
      <Card>
        <List
          loading={isLoading}
          dataSource={insights}
          locale={{ emptyText: <Empty description="暂无洞察。前往知识网络页面点击「扫描关联」生成。" /> }}
          renderItem={(item: Insight) => {
            const status = statusMap[item.status] || statusMap.new;
            return (
              <List.Item
                actions={[
                  item.status !== 'pushed_to_feishu' && (
                    <Button
                      key="push"
                      size="small"
                      icon={<SendOutlined />}
                      onClick={() => pushMutation.mutate(item.id)}
                      loading={pushMutation.isPending}
                    >
                      推送飞书
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<BulbOutlined style={{ fontSize: 24, color: '#F59E0B' }} />}
                  title={
                    <span>
                      {item.title}
                      <Tag color={status.color} className="ml-2">{status.text}</Tag>
                    </span>
                  }
                  description={
                    <div>
                      <p className="whitespace-pre-wrap">{item.content}</p>
                      <span className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
}
