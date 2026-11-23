import { NavLink } from 'react-router-dom'
import { CalendarDays, Home, ListChecks, Maximize2, Wallet } from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import styles from './BottomNav.module.css'

// `modules`: aparece se QUALQUER um dos módulos estiver ativo (null = sempre)
const TABS = [
  { to: '/', label: 'Início', icon: Home, modules: null },
  { to: '/routine', label: 'Rotina', icon: ListChecks, modules: ['tasks', 'habits'] },
  { to: '/workouts', label: 'Treinos', icon: Maximize2, modules: ['workouts'] },
  { to: '/finance', label: 'Finanças', icon: Wallet, modules: ['finance'] },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays, modules: ['calendar'] },
]

export default function BottomNav() {
  const { data: profile } = useProfile()
  const enabled: string[] = profile?.enabled_modules ?? []
  const tabs = TABS.filter((t) => !t.modules || t.modules.some((m) => enabled.includes(m)))

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
