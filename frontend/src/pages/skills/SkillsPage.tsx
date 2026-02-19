import { Card, Empty, List, Tag } from 'antd';

export default function SkillsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Skills 管理</h2>
      <Card>
        <List
          dataSource={[]}
          locale={{ emptyText: <Empty description="暂无 Skill。在 skills/ 目录下添加 YAML 配置或 Python 插件。" /> }}
          renderItem={() => null}
        />
      </Card>
    </div>
  );
}
