import { appIcon } from '../../expo/device'
import styles from './Splash.module.css'

export default function Splash() {
  return (
    <div className={styles.splash} role="status" aria-label="Carregando Hebbian">
      <img src={appIcon} alt="" width="72" height="72" />
      <strong>Hebbian</strong>
      <span className={styles.progress} aria-hidden="true" />
    </div>
  )
}
