import { NavLink } from 'react-router-dom'
import { Home, CheckCircle2, Flame, Dumbbell, Wallet } from 'lucide-react'
import styles from './BottomNav.module.css'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckCircle2 },
  { to: '/habits', label: 'Habits', icon: Flame },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/finance', label: 'Finances', icon: Wallet },
]

export default function BottomNav() {
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