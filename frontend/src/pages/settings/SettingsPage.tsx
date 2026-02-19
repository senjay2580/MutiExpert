import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  const handleSaveKeys = async (values: any) => {
    setSaving(true);
    try {
      localStorage.setItem('anthropic_api_key', values.anthropic_key || '');
      localStorage.setItem('openai_api_key', values.openai_key || '');
      message.success('API 密钥已保存到本地');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">设置</h2>
      <Tabs items={[
        {
          key: 'api',
          label: 'API 密钥',
          children: (
            <Card>
              <Form layout="vertical" className="max-w-lg" onFinish={handleSaveKeys}
                initialValues={{
                  anthropic_key: localStorage.getItem('anthropic_api_key') || '',
                  openai_key: localStorage.getItem('openai_api_key') || '',
                }}>
                <Form.Item label="Anthropic API Key (Claude)" name="anthropic_key">
                  <Input.Password placeholder="sk-ant-..." />
                </Form.Item>
                <Form.Item label="OpenAI API Key (Codex)" name="openai_key">
                  <Input.Password placeholder="sk-..." />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                    保存密钥
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          ),
        },
        {
          key: 'database',
          label: '数据库',
          children: (
            <Card>
              <Form layout="vertical" className="max-w-lg">
                <Form.Item label="PostgreSQL 连接地址">
                  <Input placeholder="postgresql://user:pass@host:5432/dbname" disabled />
                </Form.Item>
                <p className="text-gray-400 text-sm">数据库通过 Docker Compose 自动管理，无需手动配置。</p>
              </Form>
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
