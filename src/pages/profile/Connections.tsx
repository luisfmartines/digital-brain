import { useState } from 'react'
import { CalendarDays, ChevronRight, Network } from 'lucide-react'
import { useConnectGoogle, useGoogleConnection, useSyncGoogleAgenda } from '../../features/calendar/google'
import { useDevice } from '../../expo/device'
import styles from './Profile.module.css'

export default function Connections({ expandGoogle = false }: { expandGoogle?: boolean }) {
  const device = useDevice()
  const connection = useGoogleConnection()
  const connect = useConnectGoogle()
  const sync = useSyncGoogleAgenda()
  const [expanded, setExpanded] = useState(expandGoogle)
  const status = connection.isPending ? 'Verificando…' : connection.isError ? 'Status indisponível'
    : connection.data ? 'Conta vinculada' : 'Desconectado'
  return (
    <section className={styles.connections} aria-label="Conexões">
      <h2 className={styles.connectionsHeading}><Network size={18} /> Apps conectados</h2>
      <div className={styles.connectionCard}>
        <button className={styles.connectionRow} type="button" aria-expanded={expanded}
          aria-controls="google-connection-details" onClick={() => setExpanded(!expanded)}>
          <span className={styles.googleIcon}><CalendarDays size={22} /></span>
          <span>
            <span className={styles.connectionTitle}><strong>Google Agenda</strong> <small className={styles.connectionBadge}>{status}</small></span>
            <small className={styles.connectionDetail}>Calendários e planejamento</small>
          </span>
          <ChevronRight size={17} className={styles.connectionChevron} />
        </button>
        <div id="google-connection-details" className={styles.connectionDetails} hidden={!expanded}>
          {connection.data && <button className={styles.button} type="button" disabled={sync.isPending}
            onClick={() => sync.mutate()}>{sync.isPending ? 'Enviando planejamento…' : 'Sincronizar planejamento'}</button>}
          <button className={styles.button} type="button" disabled={connect.isPending} onClick={() => connect.mutate()}>
            {connect.isPending ? 'Abrindo Google…' : connection.data ? 'Reconectar Google Agenda' : 'Conectar Google Agenda'}
          </button>
          {device?.isExpoGo && connect.isSuccess && !connection.data && <p role="status" className={styles.connectionDetail}>
            Conclua a autorização no navegador e volte ao aplicativo para atualizar a conexão.
          </p>}
          {sync.isSuccess && <p role="status" className={styles.connectionDetail}>
            {sync.data.sent} novos itens enviados.{sync.data.failed ? ` ${sync.data.failed} itens falharam. Você pode tentar novamente.` : ''}
          </p>}
          {sync.isError && <p className={styles.error} role="alert">{sync.error.message}</p>}
          {connect.isError && <p className={styles.error} role="alert">{connect.error.message}</p>}
        </div>
      </div>
    </section>
  )
}
