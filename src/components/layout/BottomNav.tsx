import { NavLink } from 'react-router-dom'
import { Home, CheckCircle2, Flame, Maximize2, Wallet } from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import styles from './BottomNav.module.css'

const TABS = [
  { to: '/', label: 'Home', icon: Home, module: null },
  { to: '/tasks', label: 'Tasks', icon: CheckCircle2, module: 'tasks' },
  { to: '/habits', label: 'Habits', icon: Flame, module: 'habits' },
  { to: '/workouts', label: 'Workouts', icon: Maximize2, module: 'workouts' },
  { to: '/finance', label: 'Finances', icon: Wallet, module: 'finance' },
]

export default function BottomNav() {
  const { data: profile } = useProfile()
  const modules: string[] = profile?.enabled_modules ?? []
  const tabs = TABS.filter((t) => !t.module || modules.includes(t.module))

  return (
    <nav className={styles.nav}>
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}