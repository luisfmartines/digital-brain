import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import LoginPage from '../pages/auth/LoginPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import HomePage from '../pages/home/HomePage'
import TaskFormPage from '../pages/tasks/TaskFormPage'
import RoutinePage from '../pages/routine/RoutinePage'
import AssistantPage from '../pages/assistant/AssistantPage'
import ProfilePage from '../pages/profile/ProfilePage'
import OnboardingLayout from '../pages/onboarding/OnboardingLayout'
import OnboardingModulesPage from '../pages/onboarding/OnboardingModulesPage'
import OnboardingSetupPage from '../pages/onboarding/OnboardingSetupPage'
import OnboardingHabitsPage from '../pages/onboarding/OnboardingHabitsPage'
import OnboardingReadyPage from '../pages/onboarding/OnboardingReadyPage'
import WorkoutsPage from '../pages/workouts/WorkoutsPage'
import RoutineFormPage from '../pages/workouts/RoutineFormPage'
import ActiveWorkoutPage from '../pages/workouts/ActiveWorkoutPage'
import WorkoutSummaryPage from '../pages/workouts/WorkoutSummaryPage'
import WorkoutDetailPage from '../pages/workouts/WorkoutDetailPage'
import AddFriendsPage from '../pages/social/AddFriendsPage'
import StatsPage from '../pages/workouts/StatsPage'
import ExerciseDetailPage from '../pages/workouts/ExerciseDetailPage'
import FinancePage from '../pages/finance/FinancePage'

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

          // Amigos
          { path: '/friends/add', element: <AddFriendsPage /> },

          // Treino ativo
          { path: '/workouts/active/:id', element: <ActiveWorkoutPage /> },
          { path: '/workouts/summary/:id', element: <WorkoutSummaryPage /> },
          { path: '/workouts/view/:id', element: <WorkoutDetailPage /> },
          { path: '/workouts/exercises/:id', element: <ExerciseDetailPage /> },
          { path: '/workouts/routines/new', element: <RoutineFormPage /> },
          { path: '/workouts/routines/:id/edit', element: <RoutineFormPage /> },

          {
            element: <AppShell />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/routine', element: <RoutinePage /> },
              // Links antigos continuam funcionando
              { path: '/tasks', element: <Navigate to="/routine?tab=tasks" replace /> },
              { path: '/habits', element: <Navigate to="/routine?tab=habits" replace /> },
              { path: '/workouts', element: <WorkoutsPage /> },
              { path: '/workouts/stats', element: <StatsPage /> },
              { path: '/finance', element: <FinancePage /> },
              { path: '/calendar', element: <h1>Calendário</h1> },
              { path: '/assistant', element: <AssistantPage /> },
              { path: '/profile', element: <ProfilePage /> },
            ],
          },
        ],
      },
    ],
  },
])
