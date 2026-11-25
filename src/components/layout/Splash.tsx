import { useEffect, useState, type ReactNode } from 'react'
import { appIcon } from '../../expo/device'
import styles from './Splash.module.css'

export default function Splash({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(() => {
    try { return sessionStorage.getItem('splash') === '1' } catch { return true }
  })

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      try { sessionStorage.setItem('splash', '1') } catch { /* Optional preference. */ }
      setDone(true)
    }, 600)
    return () => clearTimeout(t)
  }, [done])

  if (done) return <>{children}</>

  return (
    <div className={styles.splash}>
      <img src={appIcon} alt="" className={styles.logo} />
      <h1 className={styles.name}>Digital Brain</h1>
    </div>
  )
}
