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
        width={240}
        style={{
          background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
          overflow: 'auto',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{
            fontSize: sidebarCollapsed ? 20 : 22,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 50%, #c4b5fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            {sidebarCollapsed ? 'ME' : 'MutiExpert'}
          </span>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px',
          }}
        />
      </Sider>
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 240, transition: 'margin-left 0.2s ease' }}>
        <Header style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        }}>
          <span
            onClick={toggleSidebar}
            style={{
              cursor: 'pointer',
              fontSize: 18,
              color: '#64748b',
              padding: '6px 8px',
              borderRadius: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.color = '#6366f1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
        </Header>
        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
