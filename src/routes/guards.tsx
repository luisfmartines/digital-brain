import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'
import { useProfile } from '../features/profile/useProfile'

function Loading() {
  return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Carregando…</div>
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  return session ? <Navigate to="/" replace /> : <Outlet />
}

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

export function RequireOnboarded() {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return <Loading />
  return profile?.onboarding_completed ? <Outlet /> : <Navigate to="/onboarding/modules" replace />
}