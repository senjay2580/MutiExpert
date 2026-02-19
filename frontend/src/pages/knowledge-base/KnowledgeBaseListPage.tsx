import { useState } from 'react';
import { Button, Card, Empty, Input, Select, Row, Col, Modal, Form, Tag, message } from 'antd';
import { PlusOutlined, SearchOutlined, BookOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { industryService } from '../../services/industryService';
import type { KnowledgeBase, Industry } from '../../types';

export default function KnowledgeBaseListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: kbs = [], isLoading } = useQuery({
    queryKey: ['knowledge-bases', industryFilter],
    queryFn: () => knowledgeBaseService.list(industryFilter),
  });

  const { data: industries = [] } = useQuery({
    queryKey: ['industries'],
    queryFn: () => industryService.list(),
  });

  const createMutation = useMutation({
    mutationFn: knowledgeBaseService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      setModalOpen(false);
      form.resetFields();
      message.success('知识库创建成功');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: knowledgeBaseService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      message.success('已删除');
    },
  });

  const filtered = kbs.filter((kb) =>
    kb.name.toLowerCase().includes(search.toLowerCase())
  );

  const getIndustryColor = (id: string | null) => {
    const ind = industries.find((i) => i.id === id);
    return ind?.color || '#999';
  };

  const getIndustryName = (id: string | null) => {
    const ind = industries.find((i) => i.id === id);
    return ind?.name || '未分类';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">知识库</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建知识库
        </Button>
      </div>
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="搜索知识库..."
          prefix={<SearchOutlined />}
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          placeholder="行业筛选"
          allowClear
          className="min-w-[140px]"
          value={industryFilter}
          onChange={setIndustryFilter}
          options={industries.map((i) => ({ value: i.id, label: i.name }))}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <Empty description={isLoading ? '加载中...' : '还没有知识库，点击上方按钮创建第一个'} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((kb) => (
            <Col xs={24} sm={12} lg={8} key={kb.id}>
              <Card
                hoverable
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
                actions={[
                  <DeleteOutlined
                    key="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      Modal.confirm({
                        title: '确认删除',
                        content: `删除知识库「${kb.name}」及其所有文档？`,
                        onOk: () => deleteMutation.mutate(kb.id),
                      });
                    }}
                  />,
                ]}
              >
                <Card.Meta
                  avatar={<BookOutlined style={{ fontSize: 24, color: getIndustryColor(kb.industry_id) }} />}
                  title={kb.name}
                  description={
                    <div>
                      <Tag color={getIndustryColor(kb.industry_id)}>{getIndustryName(kb.industry_id)}</Tag>
                      <span className="text-gray-400 ml-2">{kb.document_count} 篇文档</span>
                      {kb.description && <p className="mt-2 text-gray-500 text-sm truncate">{kb.description}</p>}
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建知识库"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
            <Input placeholder="如：AI技术前沿" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="知识库简介..." rows={3} />
          </Form.Item>
          <Form.Item name="industry_id" label="所属行业">
            <Select
              placeholder="选择行业"
              allowClear
              options={industries.map((i) => ({ value: i.id, label: i.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
