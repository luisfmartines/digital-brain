import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useProfile } from '../features/profile/useProfile'

import Splash from '../components/layout/Splash'

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  return session ? <Navigate to="/" replace /> : <Outlet />
}

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

export function RequireOnboarded() {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <Splash />
  return profile?.onboarding_completed ? <Outlet /> : <Navigate to="/onboarding/modules" replace />
}