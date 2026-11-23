import { Link, Outlet, useLocation } from 'react-router-dom'
import { BrainCircuit, Maximize2 } from 'lucide-react'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import { useProfile } from '../../features/profile/useProfile'
import { useActiveWorkout } from '../../features/workouts/queries'
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
  const { data: active } = useActiveWorkout()
  const modules: string[] = profile?.enabled_modules ?? []
  const showAi = modules.includes('assistant') && pathname !== '/assistant'
  const showWorkout = modules.includes('workouts') && !pathname.startsWith('/workouts')

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <AppHeader subtitle={SUBTITLES[pathname] ?? 'HOME'} />
        <main className={styles.content}>
          <Outlet />
        </main>
        {showWorkout && (
          <Link
            to={active ? `/workouts/active/${active.id}` : '/workouts'}
            className={`${styles.fab} ${showAi ? styles.fabStacked : ''}`}
            aria-label={active ? 'Resume workout' : 'Workouts'}
          >
            <Maximize2 size={26} />
            {active && <i className={styles.live} />}
          </Link>
        )}
        {showAi && (
          <Link to="/assistant" className={styles.fab} aria-label="AI Assistant">
            <BrainCircuit size={26} />
          </Link>
        )}
        <BottomNav />
      </div>
    </div>
  )
}