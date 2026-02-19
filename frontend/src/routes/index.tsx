import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import DashboardPage from '../pages/dashboard/DashboardPage';
import KnowledgeBaseListPage from '../pages/knowledge-base/KnowledgeBaseListPage';
import KnowledgeBaseDetailPage from '../pages/knowledge-base/KnowledgeBaseDetailPage';
import ChatListPage from '../pages/chat/ChatListPage';
import ChatConversationPage from '../pages/chat/ChatConversationPage';
import NetworkGraphPage from '../pages/network/NetworkGraphPage';
import InsightsPage from '../pages/network/InsightsPage';
import CalendarPage from '../pages/calendar/CalendarPage';
import SkillsPage from '../pages/skills/SkillsPage';
import FeishuSettingsPage from '../pages/feishu/FeishuSettingsPage';
import SettingsPage from '../pages/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'knowledge-bases', element: <KnowledgeBaseListPage /> },
      { path: 'knowledge-bases/:id', element: <KnowledgeBaseDetailPage /> },
      { path: 'chat', element: <ChatListPage /> },
      { path: 'chat/:id', element: <ChatConversationPage /> },
      { path: 'network', element: <NetworkGraphPage /> },
      { path: 'network/insights', element: <InsightsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'feishu', element: <FeishuSettingsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
