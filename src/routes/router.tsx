import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { PublicOnly, RequireAuth, RequireOnboarded } from './guards'
import * as Pages from './lazyPages'
import { isNative } from '../expo/device'

const createRouter = isNative ? createHashRouter : createBrowserRouter

export const router = createRouter([
  { path: '/privacidade', element: <Pages.LegalPage type="privacy" /> },
  { path: '/termos-de-uso', element: <Pages.LegalPage type="terms" /> },
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

          { path: '/calendar/google/edit', element: <Pages.CalendarEventPage google /> },
          { path: '/calendar/new', element: <Pages.CalendarEventPage /> },
          { path: '/calendar/:id/edit', element: <Pages.CalendarEventPage /> },

          // Amigos
          { path: '/profile/followers', element: <Pages.ProfileConnectionsPage direction="followers" /> },
          { path: '/profile/following', element: <Pages.ProfileConnectionsPage direction="following" /> },
          { path: '/profiles/:id/followers', element: <Pages.ProfileConnectionsPage direction="followers" /> },
          { path: '/profiles/:id/following', element: <Pages.ProfileConnectionsPage direction="following" /> },
          { path: '/profile/media', element: <Pages.ProfileMediaPage /> },
          { path: '/profiles/:id/media', element: <Pages.ProfileMediaPage /> },
          { path: '/feed/posts/:id/comments', element: <Pages.PostCommentsPage /> },
          { path: '/feed/communities/new', element: <Pages.CommunityFormPage /> },
          { path: '/feed/communities/:id/edit', element: <Pages.CommunityFormPage /> },
          { path: '/feed/communities/:id', element: <Pages.CommunityPage /> },
          { path: '/friends/add', element: <Pages.AddFriendsPage /> },

          // Treino ativo
          { path: '/workouts/active/:id', element: <Pages.ActiveWorkoutPage /> },
          { path: '/workouts/summary/:id', element: <Pages.WorkoutSummaryPage /> },
          { path: '/workouts/view/:id', element: <Pages.WorkoutDetailPage /> },
          { path: '/workouts/exercises/:id', element: <Pages.ExerciseDetailPage /> },
          { path: '/workouts/routines/new', element: <Pages.RoutineFormPage /> },
          { path: '/workouts/routines/:id', element: <Pages.RoutinePreviewPage /> },
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
