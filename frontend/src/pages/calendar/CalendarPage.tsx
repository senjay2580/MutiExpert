import { useEffect, useState } from 'react';
import { Calendar, Card, Modal, Form, Input, DatePicker, Select, Badge, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import api from '../../services/api';

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  start_time: string;
  end_time: string | null;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [form] = Form.useForm();

  const fetchEvents = async () => {
    try {
      const { data } = await api.get('/calendar/events');
      setEvents(data);
    } catch { /* empty */ }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/calendar/events', {
        ...values,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time?.toISOString() || null,
      });
      message.success('事件已创建');
      setModalOpen(false);
      form.resetFields();
      fetchEvents();
    } catch {
      message.error('创建失败');
    }
  };
  const dateCellRender = (value: Dayjs) => {
    const dayEvents = events.filter(e => dayjs(e.start_time).format('YYYY-MM-DD') === value.format('YYYY-MM-DD'));
    return (
      <ul className="list-none p-0 m-0">
        {dayEvents.map(e => (
          <li key={e.id}><Badge status="processing" text={e.title} /></li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">日历</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          form.setFieldsValue({ start_time: selectedDate });
          setModalOpen(true);
        }}>新建事件</Button>
      </div>
      <Card>
        <Calendar cellRender={(date) => dateCellRender(date)} onSelect={(date) => setSelectedDate(date)} />
      </Card>
      <Modal title="新建日历事件" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} okText="创建">
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="类型" name="event_type">
            <Select options={[
              { value: 'review', label: '知识复习' },
              { value: 'meeting', label: '会议' },
              { value: 'deadline', label: '截止日期' },
              { value: 'other', label: '其他' },
            ]} />
          </Form.Item>
          <Form.Item label="开始时间" name="start_time" rules={[{ required: true }]}>
            <DatePicker showTime className="w-full" />
          </Form.Item>
          <Form.Item label="结束时间" name="end_time">
            <DatePicker showTime className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
