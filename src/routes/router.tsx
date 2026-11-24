import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import * as Pages from './lazyPages'

export const router = createBrowserRouter([
  { path: '/reset-password', element: <Pages.ResetPasswordPage /> },
  {
    element: <PublicOnly />,
    children: [{ path: '/login', element: <Pages.LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/onboarding',
        element: <Pages.OnboardingLayout />,
        children: [
          { index: true, element: <Navigate to="modules" replace /> },
          { path: 'modules', element: <Pages.OnboardingModulesPage /> },
          { path: 'setup', element: <Pages.OnboardingSetupPage /> },
          { path: 'habits', element: <Pages.OnboardingHabitsPage /> },
          { path: 'ready', element: <Pages.OnboardingReadyPage /> },
        ],
      },
      {
        element: <RequireOnboarded />,
        children: [
          // Telas cheias, sem barra inferior
          { path: '/tasks/new', element: <Pages.TaskFormPage /> },
          { path: '/tasks/:id/edit', element: <Pages.TaskFormPage /> },

          { path: '/calendar/new', element: <Pages.CalendarEventPage /> },
          { path: '/calendar/:id/edit', element: <Pages.CalendarEventPage /> },

          // Amigos
          { path: '/friends/add', element: <Pages.AddFriendsPage /> },

          // Treino ativo
          { path: '/workouts/active/:id', element: <Pages.ActiveWorkoutPage /> },
          { path: '/workouts/summary/:id', element: <Pages.WorkoutSummaryPage /> },
          { path: '/workouts/view/:id', element: <Pages.WorkoutDetailPage /> },
          { path: '/workouts/exercises/:id', element: <Pages.ExerciseDetailPage /> },
          { path: '/workouts/routines/new', element: <Pages.RoutineFormPage /> },
          { path: '/workouts/routines/:id/edit', element: <Pages.RoutineFormPage /> },

          {
            element: <AppShell />,
            children: [
              { path: '/', element: <Pages.HomePage /> },
              { path: '/routine', element: <Pages.RoutinePage /> },
              // Links antigos continuam funcionando
              { path: '/tasks', element: <Navigate to="/routine?tab=tasks" replace /> },
              { path: '/habits', element: <Navigate to="/routine?tab=habits" replace /> },
              { path: '/workouts', element: <Pages.WorkoutsPage /> },
              { path: '/workouts/stats', element: <Pages.StatsPage /> },
              { path: '/finance', element: <Pages.FinancePage /> },
              { path: '/calendar', element: <Pages.CalendarPage /> },
              { path: '/assistant', element: <Pages.AssistantPage /> },
              { path: '/profile', element: <Pages.ProfilePage /> },
              { path: '/profiles/:id', element: <Pages.SharedProfilePage /> },
            ],
          },
        ],
      },
    ],
  },
])
