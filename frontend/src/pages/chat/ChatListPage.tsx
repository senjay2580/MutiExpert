import { useState } from 'react';
import { Button, Card, Empty, List, Modal, Select, message } from 'antd';
import { PlusOutlined, MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../../services/chatService';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { useAppStore } from '../../stores/useAppStore';

export default function ChatListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentModel } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKbs, setSelectedKbs] = useState<string[]>([]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatService.listConversations,
  });

  const { data: kbs = [] } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => knowledgeBaseService.list(),
  });

  const createMutation = useMutation({
    mutationFn: chatService.createConversation,
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setModalOpen(false);
      setSelectedKbs([]);
      navigate(`/chat/${conv.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      message.success('对话已删除');
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">智能问答</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建对话
        </Button>
      </div>
      <Card>
        <List
          loading={isLoading}
          dataSource={conversations}
          locale={{ emptyText: <Empty description="还没有对话，开始你的第一次知识探索" /> }}
          renderItem={(conv) => (
            <List.Item
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/chat/${conv.id}`)}
              actions={[
                <DeleteOutlined
                  key="del"
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: '删除对话',
                      content: `确认删除「${conv.title || '未命名对话'}」？`,
                      onOk: () => deleteMutation.mutate(conv.id),
                    });
                  }}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<MessageOutlined style={{ fontSize: 20 }} />}
                title={conv.title || '未命名对话'}
                description={`${conv.model_provider === 'claude' ? 'Claude' : 'Codex'} · ${new Date(conv.created_at).toLocaleString()}`}
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="新建对话"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => createMutation.mutate({ knowledge_base_ids: selectedKbs, model_provider: currentModel })}
        confirmLoading={createMutation.isPending}
      >
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">选择知识库范围</label>
          <Select
            mode="multiple"
            placeholder="选择要关联的知识库（可多选）"
            className="w-full"
            value={selectedKbs}
            onChange={setSelectedKbs}
            options={kbs.map((kb) => ({ value: kb.id, label: kb.name }))}
          />
        </div>
      </Modal>
    </div>
  );
}
