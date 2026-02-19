import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Upload, Table, Tag, message, Popconfirm } from 'antd';
import { UploadOutlined, ArrowLeftOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeBaseService, documentService } from '../../services/knowledgeBaseService';
import type { Document as DocType } from '../../types';

const statusMap: Record<string, { color: string; text: string }> = {
  uploading: { color: 'blue', text: '上传中' },
  processing: { color: 'orange', text: '处理中' },
  ready: { color: 'green', text: '就绪' },
  error: { color: 'red', text: '失败' },
};

export default function KnowledgeBaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: kb } = useQuery({
    queryKey: ['knowledge-base', id],
    queryFn: () => knowledgeBaseService.get(id!),
    enabled: !!id,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => knowledgeBaseService.listDocuments(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((d) => d.status === 'processing' || d.status === 'uploading')) return 3000;
      return false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeBaseService.uploadDocument(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', id] });
      message.success('文档上传成功，正在处理...');
    },
    onError: () => message.error('上传失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: documentService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', id] });
      message.success('文档已删除');
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: documentService.reprocess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      message.success('重新处理已启动');
    },
  });

  const columns = [
    { title: '文档名称', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '类型', dataIndex: 'file_type', key: 'file_type', width: 80,
      render: (t: string) => <Tag>{t.toUpperCase()}</Tag>,
    },
    {
      title: '大小', dataIndex: 'file_size', key: 'file_size', width: 100,
      render: (s: number) => s ? `${(s / 1024).toFixed(1)} KB` : '-',
    },
    { title: '分块数', dataIndex: 'chunk_count', key: 'chunk_count', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => {
        const info = statusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, record: DocType) => (
        <div className="flex gap-1">
          {record.status === 'error' && (
            <Button size="small" icon={<ReloadOutlined />} onClick={() => reprocessMutation.mutate(record.id)} />
          )}
          <Popconfirm title="确认删除此文档？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge-bases')} />
        <h2 className="text-xl font-semibold">{kb?.name || '知识库详情'}</h2>
        {kb?.description && <span className="text-gray-400 text-sm">{kb.description}</span>}
      </div>
      <Card
        title={`文档列表 (${docs.length})`}
        extra={
          <Upload
            beforeUpload={(file) => {
              uploadMutation.mutate(file);
              return false;
            }}
            showUploadList={false}
            accept=".pdf,.docx,.md"
          >
            <Button icon={<UploadOutlined />} type="primary" loading={uploadMutation.isPending}>
              上传文档
            </Button>
          </Upload>
        }
      >
        {docs.length === 0 ? (
          <Empty description="暂无文档，上传 PDF/Word/Markdown 文件开始构建知识库" />
        ) : (
          <Table
            dataSource={docs}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}
