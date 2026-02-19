import { useEffect, useState } from 'react';
import { Button, Card, List, Tag, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface SkillItem {
  id: string;
  name: string;
  type: string;
  file_path: string | null;
  enabled: boolean;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [registrySkills, setRegistrySkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/skills/');
      setSkills(data.db_skills || []);
      setRegistrySkills(data.registry_skills || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/skills/', values);
      message.success('Skill 已创建');
      setModalOpen(false);
      form.resetFields();
      fetchSkills();
    } catch {
      message.error('创建失败');
    }
  };
  const handleDelete = async (id: string) => {
    await api.delete(`/skills/${id}`);
    message.success('已删除');
    fetchSkills();
  };

  const handleExecute = async (id: string) => {
    try {
      const { data } = await api.post(`/skills/${id}/execute`, { params: {}, context: '' });
      if (data.success) {
        Modal.success({ title: '执行结果', content: <pre className="whitespace-pre-wrap max-h-60 overflow-auto">{data.result}</pre> });
      } else {
        message.error(data.error || '执行失败');
      }
    } catch {
      message.error('执行失败');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="page-header" style={{ margin: 0 }}>Skills 管理</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>AI 技能编排与执行</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建 Skill</Button>
        </div>
      </div>
      {registrySkills.length > 0 && (
        <Card title="注册表 Skills (registry.yaml)" style={{ borderRadius: 16, marginBottom: 16 }}>
          <List dataSource={registrySkills} renderItem={(item: any) => (
            <List.Item>
              <List.Item.Meta title={<span style={{ fontWeight: 600 }}>{item.name}</span>} description={item.description || item.path} />
              <Tag color="purple">{item.type}</Tag>
            </List.Item>
          )} />
        </Card>
      )}
      <Card title="数据库 Skills" style={{ borderRadius: 16 }}>
        <List loading={loading} dataSource={skills}
          locale={{ emptyText: '暂无数据库 Skill，点击上方按钮创建' }}
          renderItem={(item) => (
            <List.Item actions={[
              <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(item.id)}>执行</Button>,
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(item.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}>
              <List.Item.Meta title={item.name} description={item.file_path || '无文件路径'} />
              <Tag color={item.enabled ? 'green' : 'default'}>{item.enabled ? '启用' : '禁用'}</Tag>
              <Tag>{item.type}</Tag>
            </List.Item>
          )} />
      </Card>
      <Modal title="新建 Skill" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="类型" name="type" initialValue="yaml">
            <Select options={[{ value: 'yaml', label: 'YAML' }, { value: 'python', label: 'Python' }]} />
          </Form.Item>
          <Form.Item label="文件路径" name="file_path">
            <Input placeholder="yaml/my_skill.yaml" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
