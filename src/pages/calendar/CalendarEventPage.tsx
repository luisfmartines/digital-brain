import ChoiceField from '../../components/ui/ChoiceField'
import { useConfirmation } from '../../components/ui/useConfirmation'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarPlus, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EVENT_CATEGORIES, useCalendarEvent, useChangeEvent, type CalendarEvent, type EventInput } from '../../features/calendar/queries'
import { addDays, localDateStr, parseDate } from '../../lib/date'
import { useConnectedEvent, useGoogleCalendars, useGoogleConnection, type ConnectedEvent } from '../../features/calendar/google'
import styles from './Calendar.module.css'

const reminders = [
  { value: '10', label: '10 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '', label: 'Sem lembrete' },
]
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

function EventForm({ event, googleEvent, date, returnTo }: { event?: CalendarEvent; googleEvent?: ConnectedEvent; date: string; returnTo: string }) {
  const navigate = useNavigate()
  const change = useChangeEvent()
  const connection = useGoogleConnection()
  const connected = !event && !!connection.data
  const calendars = useGoogleCalendars(connected)
  const writable = calendars.data?.filter((item) => item.writable) ?? []
  const readOnly = googleEvent?.canEdit === false
  const cannotSave = readOnly || (!event && (connection.isPending || connection.isError || (connected && !writable.length)))
  const start = event ? new Date(event.starts_at) : null
  const end = event?.ends_at ? new Date(event.ends_at) : null
  const [category, setCategory] = useState<EventInput['category']>(event?.category ?? 'personal')
  const initialDay = start ? localDateStr(start) : date
  const initialEndDay = end ? localDateStr(event?.all_day ? new Date(end.getTime() - 1) : end) : ''
  const [day, setDay] = useState(initialDay)
  const [endDay, setEndDay] = useState(initialEndDay)
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [reminder, setReminder] = useState(event ? String(event.alarm_minutes_before ?? '') : '10')
  const [error, setError] = useState('')
  const confirmation = useConfirmation()
  const [calendarId, setCalendarId] = useState('')
  const selectedCalendar = writable.find((item) => item.id === calendarId)?.id ?? writable.find((item) => item.primary)?.id ?? writable[0]?.id

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const values = new FormData(e.currentTarget)
    const title = String(values.get('title') ?? '').trim()
    const description = String(values.get('description') ?? '').trim()
    const startTime = String(values.get('startTime') ?? '')
    const endTime = String(values.get('endTime') ?? '')
    const starts = allDay ? parseDate(day) : new Date(`${day}T${startTime}`)
    const ends = allDay ? addDays(parseDate(endDay || day), 1) : endTime ? new Date(`${endDay || day}T${endTime}`) : null
    if (!title || !Number.isFinite(starts.getTime())) {
      setError('Preencha o título e o início do evento.')
      return
    }
    if ((!allDay && endDay && !endTime) || (ends && (!Number.isFinite(ends.getTime()) || ends <= starts))) {
      setError('Informe um término depois do início.')
      return
    }
    try {
      if (cannotSave) return
      const input: EventInput = {
        title, description: description || null, category, all_day: allDay,
        starts_at: starts.toISOString(), ends_at: ends?.toISOString() ?? null,
        alarm_minutes_before: allDay || !reminder ? null : Number(reminder),
      }
      if (googleEvent) {
        const scheduleChanged = allDay !== googleEvent.all_day || day !== initialDay || endDay !== initialEndDay
          || (!allDay && (startTime !== (start ? clock.format(start) : '') || endTime !== (end ? clock.format(end) : '')))
        await change.mutateAsync({
          google: googleEvent.google, input, scheduleChanged,
          reminderChanged: reminder !== String(googleEvent.alarm_minutes_before ?? ''),
        })
      } else {
        await change.mutateAsync({ id: event?.id, calendarId: connected ? selectedCalendar : undefined, input })
      }
      const next = new URL(returnTo, 'https://digital-brain.invalid')
      next.searchParams.set('date', day)
      navigate(next.pathname + next.search, { replace: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar o evento. Tente novamente.')
    }
  }

  async function remove() {
    if (!event) return
    setError('')
    try {
      await change.mutateAsync(googleEvent ? { google: googleEvent.google, remove: true } : { id: event.id, remove: true })
      navigate(returnTo, { replace: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível excluir o evento. Tente novamente.')
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      {connected && (
        <section className={styles.panel}>
          {writable.length > 0 ? (
            <ChoiceField label="Calendário do Google" name="calendarId" value={selectedCalendar ?? ''}
              onChange={setCalendarId} options={writable.map(({ id, name }) => ({ value: id, label: name }))} />
          ) : <p role="status">{calendars.isPending ? 'Carregando calendários…' : calendars.error?.message ?? 'Nenhum calendário permite criar eventos.'}</p>}
          {!writable.length && !calendars.isPending && <Link to="/profile?tab=connections">Conexões</Link>}
        </section>
      )}
      {googleEvent && <p className={styles.muted}>{googleEvent.recurring ? 'Google Agenda · Esta ocorrência' : 'Google Agenda'}</p>}
      {readOnly && <p role="status" className={styles.muted}>O Google Agenda restringe a edição deste evento.</p>}
      <div className={styles.categories} role="group" aria-label="Categoria">
        {Object.entries(EVENT_CATEGORIES).map(([id, label]) => (
          <button key={id} type="button" className={styles.soft} aria-pressed={category === id}
            disabled={readOnly} onClick={() => setCategory(id as EventInput['category'])}>{label}</button>
        ))}
      </div>
      {connection.isError && !event && <p role="alert">Não foi possível verificar a conexão. <button type="button" onClick={() => void connection.refetch()}>Tentar novamente</button></p>}
      <section className={styles.panel}>
        <label>Título do evento<input name="title" readOnly={readOnly} defaultValue={event?.title} required maxLength={120} /></label>
        <label>Notas<textarea name="description" readOnly={readOnly} defaultValue={event?.description ?? ''} rows={3} maxLength={googleEvent ? undefined : 500} /></label>
        {googleEvent?.location && <p className={styles.muted}>{googleEvent.location}</p>}
      </section>
      <section className={styles.panel}>
        <h2>Data e horário</h2>
        <label className={styles.checkbox}><input type="checkbox" disabled={readOnly} checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Dia inteiro</label>
        <div className={styles.fields}>
          <label>Data de início<input type="date" readOnly={readOnly} value={day} required onChange={(e) => {
            const next = e.target.value
            setDay(next)
            if (endDay && endDay < next) setEndDay('')
          }} /></label>
          {!allDay && <label>Hora de início<input type="time" readOnly={readOnly} name="startTime" defaultValue={start ? clock.format(start) : '09:00'} required /></label>}
          <label>Data de término<input type="date" readOnly={readOnly} value={endDay} min={day} onChange={(e) => setEndDay(e.target.value)} /></label>
          {!allDay && <label>Hora de término<input type="time" readOnly={readOnly} name="endTime" defaultValue={end ? clock.format(end) : ''} /></label>}
        </div>
      </section>
      {!allDay && (
        <fieldset className={styles.panel} disabled={readOnly}>
          <legend>Lembrete na agenda</legend>
          <div className={styles.reminders}>
            {reminder && !reminders.some((option) => option.value === reminder) && (
              <label><input type="radio" name="reminder" checked readOnly />{reminder} minutos</label>
            )}
            {reminders.map(({ value, label }) => (
              <label key={value}><input type="radio" name="reminder" checked={value === reminder} onChange={() => setReminder(value)} />{label}</label>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!readOnly && <button className={styles.primary} type="submit" disabled={change.isPending || cannotSave}><CalendarPlus size={18} /> Salvar evento</button>}
      <Link className={styles.soft} to={returnTo}>Cancelar</Link>
      {event && <button className={styles.danger} type="button" disabled={change.isPending}
        onClick={() => confirmation.ask({ title: googleEvent?.recurring ? 'Excluir esta ocorrência?' : 'Excluir este evento?', danger: true, confirmLabel: 'Confirmar exclusão', onConfirm: remove })}>
        <Trash2 size={16} /> Excluir evento
      </button>}
      {confirmation.dialog}
    </form>
  )
}

export default function CalendarEventPage({ google = false }: { google?: boolean }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { state } = useLocation()
  const event = useCalendarEvent(google ? undefined : id)
  const calendarId = params.get('calendar')
  const eventId = params.get('event')
  const connected = useConnectedEvent(google && calendarId && eventId ? { calendarId, eventId } : undefined)
  const fallback = google && connected.data ? '/calendar?view=day&date=' + localDateStr(new Date(connected.data.starts_at)) : '/calendar'
  const returnTo = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/calendar?') ? state.returnTo : fallback
  const requested = params.get('date') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) && localDateStr(parseDate(requested)) === requested
    ? requested : localDateStr()

  return (
    <main className={styles.standalone}>
      <div className={styles.formHeading}>
        <Link to={returnTo} aria-label="Voltar ao calendário" className={styles.soft}><ArrowLeft size={20} /></Link>
        <h1>{id || google ? 'Editar evento' : 'Novo evento'}</h1>
      </div>
      {google ? (
        connected.data ? <EventForm key={JSON.stringify([calendarId, eventId, connected.data.google.etag])} event={connected.data}
          googleEvent={connected.data} date={date} returnTo={returnTo} />
          : <p role={connected.isError ? 'alert' : 'status'} className={connected.isError ? styles.error : styles.muted}>
            {!calendarId || !eventId ? 'Evento indisponível.' : connected.error?.message ?? 'Carregando evento…'}
          </p>
      ) : !id || event.data ? <EventForm key={id ?? date} event={event.data} date={date} returnTo={returnTo} />
        : <p role="status" className={event.isError ? styles.error : styles.muted}>{event.isError ? 'Evento indisponível.' : 'Carregando evento…'}</p>}
    </main>
  )
}
