import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.tsx'
import styles from './AppShell.module.css'

export default function AppShell() {
  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <main className={styles.content}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}