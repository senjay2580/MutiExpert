import { Button, Card, Form, Input, Switch } from 'antd';

export default function FeishuSettingsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">飞书集成</h2>
      <Card title="飞书机器人配置">
        <Form layout="vertical" className="max-w-lg">
          <Form.Item label="App ID">
            <Input placeholder="飞书应用 App ID" />
          </Form.Item>
          <Form.Item label="App Secret">
            <Input.Password placeholder="飞书应用 App Secret" />
          </Form.Item>
          <Form.Item label="Webhook URL">
            <Input placeholder="飞书群 Webhook 地址" />
          </Form.Item>
          <Form.Item label="启用机器人">
            <Switch />
          </Form.Item>
          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary">保存配置</Button>
              <Button>测试连接</Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
