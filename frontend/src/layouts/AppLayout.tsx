import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/knowledge-bases', icon: <BookOutlined />, label: '知识库' },
  { key: '/chat', icon: <MessageOutlined />, label: '智能问答' },
  { key: '/network', icon: <NodeIndexOutlined />, label: '知识网络' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '日历' },
  { key: '/skills', icon: <ThunderboltOutlined />, label: 'Skills' },
  { key: '/feishu', icon: <RobotOutlined />, label: '飞书集成' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        theme="light"
        width={220}
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div className="flex items-center justify-center h-16 border-b border-gray-100">
          <span className="text-lg font-bold text-blue-600">
            {sidebarCollapsed ? 'ME' : 'MutiExpert'}
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="flex items-center bg-white px-4 h-16" style={{ borderBottom: '1px solid #f0f0f0', padding: '0 16px' }}>
          <span onClick={toggleSidebar} className="cursor-pointer text-lg mr-4">
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
        </Header>
        <Content className="p-6 bg-gray-50">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
