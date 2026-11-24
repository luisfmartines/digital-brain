import { CalendarDays } from 'lucide-react'
import { useConnectGoogle, useGoogleConnection } from '../../features/calendar/google'
import styles from './Profile.module.css'

export default function Connections() {
  const connection = useGoogleConnection()
  const connect = useConnectGoogle()
  return (
    <section className={styles.card} aria-label="Conexões">
      <div className={styles.person}>
        <span className={styles.icon}><CalendarDays size={18} /></span>
        <div>
          <h2>Google Agenda</h2>
          <small aria-live="polite">{connection.isPending ? 'Verificando conexão…' : connection.isError ? 'Status indisponível' : connection.data ? 'Conta vinculada' : 'Desconectado'}</small>
        </div>
      </div>
      <p className={styles.connectionDetail}>Mostra os eventos do seu calendário principal e envia para lá os eventos criados no app ou pelo Neural.</p>
      <button className={styles.button} type="button" disabled={connect.isPending} onClick={() => connect.mutate()}>
        {connect.isPending ? 'Abrindo Google…' : connection.data ? 'Reconectar Google Agenda' : 'Conectar Google Agenda'}
      </button>
      {connect.isError && <p className={styles.error} role="alert">{connect.error.message}</p>}
    </section>
  )
}
