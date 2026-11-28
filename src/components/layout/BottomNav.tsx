import { NavLink } from 'react-router-dom'
import { useProfile } from '../../features/profile/useProfile'
import { mainNavigation } from './navigation'
import styles from './BottomNav.module.css'

export default function BottomNav() {
  const { data: profile } = useProfile()
  const enabled: string[] = profile?.enabled_modules ?? []
  const tabs = mainNavigation(enabled)

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
