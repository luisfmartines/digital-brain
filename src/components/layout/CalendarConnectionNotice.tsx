import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import styles from './AppShell.module.css'

const MESSAGES = {
  connected: 'Google Agenda conectado.',
  denied: 'A conexão com o Google Agenda foi cancelada.',
  error: 'Não foi possível conectar o Google Agenda.',
}

export default function CalendarConnectionNotice() {
  const [params, setParams] = useSearchParams()
  const cache = useQueryClient()
  const status = params.get('calendar')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (status !== 'connected' && status !== 'denied' && status !== 'error') return
    const timer = window.setTimeout(() => {
      setNotice(MESSAGES[status])
      void cache.invalidateQueries({ queryKey: ['google-calendar-connection'] })
      void cache.invalidateQueries({ queryKey: ['calendar'] })
      setParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete('calendar')
        return next
      }, { replace: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [cache, setParams, status])
  if (!notice) return null
  return <aside className={styles.calendarNotice}><span role="status">{notice}</span> <Link to="/profile?tab=connections" onClick={() => setNotice('')}>Conexões</Link><button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></aside>
}
