import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import LoginPage from '../pages/auth/LoginPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import HomePage from '../pages/home/HomePage'
import TasksPage from '../pages/tasks/TasksPage'
import TaskFormPage from '../pages/tasks/TaskFormPage'
import HabitsPage from '../pages/habits/HabitsPage'
import AssistantPage from '../pages/assistant/AssistantPage'
import ProfilePage from '../pages/profile/ProfilePage'
import OnboardingLayout from '../pages/onboarding/OnboardingLayout'
import OnboardingModulesPage from '../pages/onboarding/OnboardingModulesPage'
import OnboardingSetupPage from '../pages/onboarding/OnboardingSetupPage'
import OnboardingHabitsPage from '../pages/onboarding/OnboardingHabitsPage'
import OnboardingReadyPage from '../pages/onboarding/OnboardingReadyPage'

const Page = ({ title }: { title: string }) => <h1>{title}</h1>

export const router = createBrowserRouter([
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <PublicOnly />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/onboarding',
        element: <OnboardingLayout />,
        children: [
          { index: true, element: <Navigate to="modules" replace /> },
          { path: 'modules', element: <OnboardingModulesPage /> },
          { path: 'setup', element: <OnboardingSetupPage /> },
          { path: 'habits', element: <OnboardingHabitsPage /> },
          { path: 'ready', element: <OnboardingReadyPage /> },
        ],
      },
      {
        element: <RequireOnboarded />,
        children: [
          // Telas cheias, sem barra inferior
          { path: '/tasks/new', element: <TaskFormPage /> },
          { path: '/tasks/:id/edit', element: <TaskFormPage /> },
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/tasks', element: <TasksPage /> },
              { path: '/habits', element: <HabitsPage /> },
              { path: '/workouts', element: <Page title="Workouts" /> },
              { path: '/finance', element: <Page title="Finances" /> },
              { path: '/calendar', element: <Page title="Calendar" /> },
              { path: '/assistant', element: <AssistantPage /> },
              { path: '/profile', element: <ProfilePage /> },
            ],
          },
        ],
      },
    ],
  },
])