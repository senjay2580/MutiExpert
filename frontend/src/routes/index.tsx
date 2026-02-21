import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import SettingsLayout from '../layouts/SettingsLayout';
import DashboardPage from '../pages/dashboard/DashboardPage';
import AIAssistantPage from '../pages/assistant/AIAssistantPage';
import AIAssistantChatPage from '../pages/assistant/AIAssistantChatPage';
import KnowledgePage from '../pages/knowledge/KnowledgePage';
import KnowledgeDetailPage from '../pages/knowledge/KnowledgeDetailPage';
import AIModelsPage from '../pages/settings/AIModelsPage';
import BasicSettingsPage from '../pages/settings/BasicSettingsPage';
import IntegrationsPage from '../pages/settings/IntegrationsPage';
import DataManagementPage from '../pages/settings/DataManagementPage';
import ScheduledTasksPage from '../pages/scheduler/ScheduledTasksPage';
import ScriptsPage from '../pages/scripts/ScriptsPage';
import BotToolsPage from '../pages/bot-tools/BotToolsPage';
import SkillsPage from '../pages/skills/SkillsPage';
import BoardListPage from '../pages/boards/BoardListPage';
import BoardEditorPage from '../pages/boards/BoardEditorPage';
import HelpCenterPage from '../pages/help/HelpCenterPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'assistant', element: <AIAssistantPage /> },
      { path: 'assistant/chat/:conversationId?', element: <AIAssistantChatPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'knowledge/:industryId', element: <KnowledgeDetailPage /> },
      { path: 'scheduler', element: <ScheduledTasksPage /> },
      { path: 'scripts', element: <ScriptsPage /> },
      { path: 'bot-tools', element: <BotToolsPage /> },
      { path: 'skills', element: <SkillsPage /> },
      { path: 'boards', element: <BoardListPage /> },
      { path: 'boards/:boardId', element: <BoardEditorPage /> },
      { path: 'help', element: <HelpCenterPage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="basic" replace /> },
          { path: 'basic', element: <BasicSettingsPage /> },
          { path: 'ai-models', element: <AIModelsPage /> },
          { path: 'integrations', element: <IntegrationsPage /> },
          { path: 'data', element: <DataManagementPage /> },
        ],
      },
    ],
  },
]);
