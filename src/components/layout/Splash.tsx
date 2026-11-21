import { useEffect, useState, type ReactNode } from 'react'
import styles from './Splash.module.css'

export default function Splash({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(() => sessionStorage.getItem('splash') === '1')

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      sessionStorage.setItem('splash', '1')
      setDone(true)
    }, 2200)
    return () => clearTimeout(t)
  }, [done])

  if (done) return <>{children}</>

  return (
    <div className={styles.splash}>
      <img src="/icons/icon-192.png" alt="" className={styles.logo} />
      <h1 className={styles.name}>Digital Brain</h1>
    </div>
  )
}