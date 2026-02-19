import { Calendar, Card } from 'antd';

export default function CalendarPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">日历</h2>
      <Card>
        <Calendar />
      </Card>
    </div>
  );
}
