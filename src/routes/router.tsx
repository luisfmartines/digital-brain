import { createBrowserRouter } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'

const Page = ({ title }: { title: string }) => <h1>{title}</h1>

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Page title="Home" /> },
      { path: '/tasks', element: <Page title="Tasks" /> },
      { path: '/habits', element: <Page title="Habits" /> },
      { path: '/workouts', element: <Page title="Workouts" /> },
      { path: '/finance', element: <Page title="Finances" /> },
    ],
  },
])