import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import SettingsLayout from '../layouts/SettingsLayout';
import DashboardPage from '../pages/dashboard/DashboardPage';
import KnowledgePage from '../pages/knowledge/KnowledgePage';
import KnowledgeDetailPage from '../pages/knowledge/KnowledgeDetailPage';
import ChatListPage from '../pages/chat/ChatListPage';
import ChatConversationPage from '../pages/chat/ChatConversationPage';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import AIModelsPage from '../pages/settings/AIModelsPage';
import IntegrationsPage from '../pages/settings/IntegrationsPage';
import DataManagementPage from '../pages/settings/DataManagementPage';
import SkillsPage from '../pages/skills/SkillsPage';
import ScheduledTasksPage from '../pages/scheduler/ScheduledTasksPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'knowledge/:industryId', element: <KnowledgeDetailPage /> },
      { path: 'chat', element: <ChatListPage /> },
      { path: 'chat/:id', element: <ChatConversationPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'scheduler', element: <ScheduledTasksPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="ai-models" replace /> },
          { path: 'ai-models', element: <AIModelsPage /> },
          { path: 'integrations', element: <IntegrationsPage /> },
          { path: 'data', element: <DataManagementPage /> },
        ],
      },
    ],
  },
]);
