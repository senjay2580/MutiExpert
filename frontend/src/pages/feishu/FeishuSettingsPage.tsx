import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Switch, message } from 'antd';
import api from '../../services/api';

interface FeishuConfigData {
  app_id: string;
  webhook_url: string;
  bot_enabled: boolean;
}

export default function FeishuSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get('/feishu/config').then(({ data }) => {
      form.setFieldsValue(data);
    });
  }, [form]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      await api.put('/feishu/config', values);
      message.success('配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post('/feishu/test-connection');
      message.success('连接成功');
    } catch {
      message.error('连接失败，请检查配置');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">飞书集成</h2>
      <Card title="飞书机器人配置">
        <Form form={form} layout="vertical" className="max-w-lg">
          <Form.Item label="App ID" name="app_id">
            <Input placeholder="飞书应用 App ID" />
          </Form.Item>
          <Form.Item label="App Secret" name="app_secret">
            <Input.Password placeholder="飞书应用 App Secret" />
          </Form.Item>
          <Form.Item label="Webhook URL" name="webhook_url">
            <Input placeholder="飞书群 Webhook 地址" />
          </Form.Item>
          <Form.Item label="启用机器人" name="bot_enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <div className="flex gap-2">
              <Button type="primary" onClick={handleSave} loading={loading}>保存配置</Button>
              <Button onClick={handleTest} loading={testing}>测试连接</Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
