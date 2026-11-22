import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrainCircuit } from 'lucide-react'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import { useProfile } from '../../features/profile/useProfile'
import styles from './AppShell.module.css'

const SUBTITLES: Record<string, string> = {
  '/': 'HOME',
  '/tasks': 'TASKS',
  '/habits': 'HABITS',
  '/workouts': 'WORKOUTS',
  '/finance': 'FINANCES',
    '/calendar': 'CALENDAR',
  '/assistant': 'AI ASSISTANT',
  '/profile': 'PROFILE',
}

export default function AppShell() {
  const { pathname } = useLocation()
  const { data: profile } = useProfile()
  const modules: string[] = profile?.enabled_modules ?? []
  const showFab = modules.includes('assistant') && pathname !== '/assistant'

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <AppHeader subtitle={SUBTITLES[pathname] ?? 'HOME'} />
        <main className={styles.content}>
          <Outlet />
        </main>
        {showFab && (
          <Link to="/assistant" className={styles.fab} aria-label="AI Assistant">
            <BrainCircuit size={26} />
          </Link>
        )}
        <BottomNav />
      </div>
    </div>
  )
}