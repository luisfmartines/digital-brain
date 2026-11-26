import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AlarmClock, CalendarDays, ChevronLeft, ChevronRight, Link2, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useConnectGoogle, useGoogleCalendars, useGoogleConnection, useGoogleEvents } from '../../features/calendar/google'
import type { AgendaItem } from '../../features/calendar/agenda'
import { useDevice } from '../../expo/device'
import { EVENT_CATEGORIES, useCalendarEvents, useCalendarSchedule, type CalendarEvent } from '../../features/calendar/queries'
import { addDays, localDateStr, parseDate, startOfDay, startOfWeek } from '../../lib/date'
import styles from './Calendar.module.css'

const VIEWS = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
] as const
const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

function isOnDay(event: CalendarEvent, day: Date) {
  const starts = new Date(event.starts_at)
  return starts < addDays(day, 1) && (event.ends_at ? new Date(event.ends_at) > day : starts >= day)
}

function eventTime(event: AgendaItem, day: Date) {
  if (event.all_day) return 'Dia inteiro'
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  if (start < day) return end && end < addDays(day, 1) ? `Até ${time.format(end)}` : 'Em andamento'
  return end && end < addDays(day, 1) ? `${time.format(start)}–${time.format(end)}` : time.format(start)
}

function EventCard({ event, day, returnTo }: { event: AgendaItem; day: Date; returnTo: string }) {
  const device = useDevice()
  return (
    <Link to={event.href} state={event.kind === 'google' ? undefined : { returnTo }} target={event.kind === 'google' ? '_blank' : undefined} rel={event.kind === 'google' ? 'noopener noreferrer' : undefined} className={styles.event} data-category={event.category} style={event.originColor ? { '--event-color': event.originColor } as CSSProperties : undefined}
      onClick={device && event.kind === 'google' ? (click) => {
        click.preventDefault()
        void device.openLink(event.href)
      } : undefined}>
      <span className={styles.eventInfo}>
        <strong>{event.title}</strong>
        <small>
          {eventTime(event, day)} · {event.kind === 'task' ? 'Tarefa' : event.kind === 'google' ? 'Google Agenda' : EVENT_CATEGORIES[event.category]}
          {event.origin && ` · ${event.origin}`}
          {event.completed && ' · Concluída'}
        </small>
        {event.description && <small className={styles.description}>{event.description}</small>}
      </span>
      <ChevronRight size={16} />
    </Link>
  )
}

export default function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const [now, setNow] = useState(() => Date.now())
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const today = startOfDay(new Date(now))
  const todayKey = localDateStr(today)
  const requested = params.get('date') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? parseDate(requested) : today
  const selected = localDateStr(date) === requested ? date : today
  const selectedKey = localDateStr(selected)
  const view = VIEWS.find((v) => v.id === params.get('view'))?.id ?? 'month'
  const week = startOfWeek(selected)
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const last = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const from = view === 'month' ? startOfWeek(first) : week
  const until = view === 'month' ? addDays(startOfWeek(last), 7) : addDays(week, 7)
  const events = useCalendarEvents(from, until)
  const connection = useGoogleConnection()
  const connect = useConnectGoogle()
  const device = useDevice()
  const calendars = useGoogleCalendars(!!connection.data)
  const google = useGoogleEvents(from, until, !!connection.data)
  const schedule = useCalendarSchedule(from, until)
  const rows = useMemo(() => {
    const localIds = new Set([
      ...(events.data ?? []).map(({ id }) => 'dbe' + id.replaceAll('-', '')),
      ...(schedule.data ?? []).map(({ id }) => 'dbt' + id.replace(/^task:/, '').replaceAll('-', '')),
    ])
    return [
      ...(events.data ?? []).map((event): AgendaItem => ({ ...event, kind: 'event', href: `/calendar/${event.id}/edit` })),
      ...(schedule.data ?? []),
      ...(google.data?.items ?? []).filter((item) => !item.exportedFrom || !localIds.has(item.exportedFrom)),
    ].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  }, [events.data, schedule.data, google.data])
  const pending = events.isPending || schedule.isPending || connection.isPending || (!!connection.data && google.isPending)
  const showAgenda = !pending && (rows.length > 0 || (!events.isError && !schedule.isError))
  const days: Date[] = []
  for (let day = from; day < until; day = addDays(day, 1)) days.push(day)

  const returnTo = `/calendar?view=${view}&date=${selectedKey}`
  const dayEvents = rows.filter((event) => isOnDay(event, selected))
  const visibleCount = view === 'day' ? dayEvents.length : view === 'week'
    ? rows.length
    : rows.filter((event) => new Date(event.starts_at) < addDays(last, 1)
      && (event.ends_at ? new Date(event.ends_at) > first : new Date(event.starts_at) >= first)).length
  const alert = rows.find((event) => {
    const remaining = Date.parse(event.starts_at) - now
    return !event.all_day && !event.completed && !dismissedAlerts.includes(event.id) && remaining > 0
      && remaining <= (event.alarm_minutes_before ?? 0) * 60_000
  })

  function go(day: Date, nextView = view) {
    setParams({ view: nextView, date: localDateStr(day) }, { replace: true })
  }

  function move(amount: number) {
    if (view === 'month') go(new Date(first.getFullYear(), first.getMonth() + amount, 1))
    else go(addDays(selected, view === 'week' ? amount * 7 : amount))
  }

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1>Calendário</h1>
        <button className={styles.soft} type="button" onClick={() => go(today)}><CalendarDays size={15} /> Hoje</button>
      </div>
      <div className={styles.googleShortcut}>
        {connection.data ? (
          <Link className={styles.soft} to="/profile?tab=connections&show=google"><Link2 size={16} /> Gerenciar Google Agenda</Link>
        ) : (
          <button className={styles.soft} type="button" disabled={connection.isPending || connect.isPending} onClick={() => connect.mutate()}>
            <Link2 size={16} /> {connect.isPending ? 'Abrindo Google…' : 'Conectar Google Agenda'}
          </button>
        )}
        {connect.isError && <p className={styles.error} role="alert">{connect.error.message}</p>}
        {device?.isExpoGo && connect.isSuccess && !connection.data && (
          <p className={styles.muted} role="status">Conclua a autorização no navegador e volte ao aplicativo.</p>
        )}
      </div>
      {google.data?.warnings.map((warning) => <p key={warning} className={styles.muted} role="status">{warning} <Link to="/profile?tab=connections">Conexões</Link></p>)}
      {google.isError && <p className={styles.error} role="alert">{google.error.message} <Link to="/profile?tab=connections">Conexões</Link></p>}
      {connection.isError && <p className={styles.error} role="alert">Não foi possível verificar a conexão com o Google Agenda.</p>}
      <div className={styles.segmented} role="tablist" aria-label="Visualização do calendário">
        {VIEWS.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => go(selected, id)}>{label}</button>
        ))}
      </div>
      <section className={styles.panel} aria-label="Navegação de datas">
        <div className={styles.period}>
          <button className={styles.soft} type="button" aria-label="Período anterior" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <strong>{view === 'month' ? monthLabel.format(selected) : view === 'week'
            ? `${shortDate.format(week)} – ${shortDate.format(addDays(week, 6))}` : fullDate.format(selected)}</strong>
          <button className={styles.soft} type="button" aria-label="Próximo período" onClick={() => move(1)}><ChevronRight size={18} /></button>
        </div>
        <div className={styles.weekdays} aria-hidden="true">
          {weekdays.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className={styles.days}>
          {days.map((day) => {
            const key = localDateStr(day)
            const dayRows = rows.filter((event) => isOnDay(event, day))
            const categories = [...new Set(dayRows.map((event) => event.category))]
            return (
              <button key={key} type="button" onClick={() => go(day)} aria-pressed={key === selectedKey}
                aria-label={`${fullDate.format(day)}, ${dayRows.length} compromisso(s)`}
                aria-current={key === todayKey ? 'date' : undefined}
                className={view === 'month' && day.getMonth() !== selected.getMonth() ? styles.otherMonth : undefined}>
                <span>{day.getDate()}</span>
                <span className={styles.dots} aria-hidden="true">{categories.map((category) => <i key={category} data-category={category} />)}</span>
              </button>
            )
          })}
        </div>
        {view === 'month' && (
          <div className={styles.legend}>
            {connection.data ? calendars.data?.map(({ id, name, color }) => (
              <span key={id}><i style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(color ?? '') ? color : 'var(--color-primary)' }} />{name}</span>
            )) : Object.entries(EVENT_CATEGORIES).map(([category, label]) => <span key={category}><i data-category={category} />{label}</span>)}
          </div>
        )}
        {showAgenda && <small className={styles.muted}>{visibleCount} {visibleCount === 1 ? 'compromisso' : 'compromissos'} no período</small>}
      </section>

      {pending && <p className={styles.muted} role="status">Carregando agenda…</p>}
      {events.isError && <p className={styles.error} role="alert">Não foi possível carregar seus eventos.</p>}
      {schedule.isError && <p className={styles.error} role="alert">Não foi possível carregar suas tarefas na agenda.</p>}
      {alert && (
        <article className={styles.alert}>
          <div className={styles.heading}>
            <small><AlarmClock size={15} /> Começa em {Math.ceil((Date.parse(alert.starts_at) - now) / 60_000)} min</small>
            <button className={styles.soft} type="button" onClick={() => setDismissedAlerts((ids) => [...ids, alert.id])}>Dispensar</button>
          </div>
          <Link to={alert.href} state={{ returnTo }}>{alert.title}</Link>
        </article>
      )}

      {showAgenda && (
        view === 'week' ? (
          <section className={styles.agenda}>
            <h2>Agenda da semana</h2>
            <div className={styles.weekAgenda} tabIndex={0} role="region" aria-label="Compromissos por dia da semana">
              {days.map((day) => {
                const items = rows.filter((event) => isOnDay(event, day))
                return (
                  <div key={localDateStr(day)} className={styles.dayGroup}>
                    <h3>{fullDate.format(day)}</h3>
                    {items.length ? items.map((event) => <EventCard key={event.id} event={event} day={day} returnTo={returnTo} />)
                      : <small className={styles.muted}>Sem compromissos</small>}
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className={styles.agenda}>
            <h2>{fullDate.format(selected)}</h2>
            {dayEvents.length ? dayEvents.map((event) => <EventCard key={event.id} event={event} day={selected} returnTo={returnTo} />)
              : <p className={styles.empty}>Nenhum compromisso neste dia.</p>}
          </section>
        )
      )}
      <Link to={`/calendar/new?date=${selectedKey}`} state={{ returnTo }} className={styles.primary}><Plus size={18} /> Novo evento</Link>
    </div>
  )
}
