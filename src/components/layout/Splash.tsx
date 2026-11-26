import { useEffect, useState, type ReactNode } from 'react'
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
    <div className={styles.splash} role="status">Carregando…</div>
  )
}
