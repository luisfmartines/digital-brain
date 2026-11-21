import { createBrowserRouter } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import LoginPage from '../pages/auth/LoginPage'
import HomePage from '../pages/home/HomePage'
import OnboardingModulesPage from '../pages/onboarding/OnboardingModulesPage'

const Page = ({ title }: { title: string }) => <h1>{title}</h1>

export const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding/modules', element: <OnboardingModulesPage /> },
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/tasks', element: <Page title="Tasks" /> },
              { path: '/habits', element: <Page title="Habits" /> },
              { path: '/workouts', element: <Page title="Workouts" /> },
              { path: '/finance', element: <Page title="Finances" /> },
            ],
          },
        ],
      },
    ],
  },
])