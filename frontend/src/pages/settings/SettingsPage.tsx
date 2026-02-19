import { Card, Form, Input, Tabs } from 'antd';

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">设置</h2>
      <Tabs items={[
        {
          key: 'api',
          label: 'API 密钥',
          children: (
            <Card>
              <Form layout="vertical" className="max-w-lg">
                <Form.Item label="Anthropic API Key (Claude)">
                  <Input.Password placeholder="sk-ant-..." />
                </Form.Item>
                <Form.Item label="OpenAI API Key (Codex)">
                  <Input.Password placeholder="sk-..." />
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
                <Form.Item label="Supabase URL">
                  <Input placeholder="https://your-project.supabase.co" />
                </Form.Item>
                <Form.Item label="Supabase Anon Key">
                  <Input.Password placeholder="eyJ..." />
                </Form.Item>
              </Form>
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
