import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { addDays, localDateStr, parseDate, startOfDay, startOfWeek } from '../../lib/date'
import { useHistory, type HistoryItem } from '../../features/workouts/queries'
import { fmtNum, mins } from './helpers'
import styles from './WorkoutTimeline.module.css'

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

export default function WorkoutTimeline() {
  const today = startOfDay()
  const todayKey = localDateStr(today)
  const [selected, setSelected] = useState(todayKey)
  const weekStart = startOfWeek(parseDate(selected))
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const end = days[days.length - 1]
  const query = useHistory(localDateStr(weekStart))
  const workoutsByDay = new Map<string, HistoryItem[]>()
  for (const workout of query.data ?? []) {
    const key = localDateStr(new Date(workout.ended_at))
    const entries = workoutsByDay.get(key)
    if (entries) entries.push(workout)
    else workoutsByDay.set(key, [workout])
  }
  const trainingDays = workoutsByDay.size
  const workouts = workoutsByDay.get(selected) ?? []
  const seconds = workouts.reduce((sum, workout) => sum + workout.seconds, 0)
  const stats = [
    { label: 'Volume (kg)', value: workouts.reduce((sum, workout) => sum + workout.volume, 0) },
    { label: 'Séries', value: workouts.reduce((sum, workout) => sum + workout.sets, 0) },
    { label: 'Tempo (min)', value: seconds > 0 ? mins(seconds) : 0 },
  ].filter(({ value }) => value > 0)

  function moveWeek(amount: number) {
    const next = localDateStr(addDays(parseDate(selected), amount * 7))
    setSelected(next > todayKey ? todayKey : next)
  }

  return (
    <section className={styles.timeline} aria-label="Treinos por dia">
      <div className={styles.week}>
        <header className={styles.weekHeader}>
          <div>
            <h2>Semana de treino</h2>
            <p>{shortDate.format(weekStart)} – {shortDate.format(end)}</p>
          </div>
          <div className={styles.weekArrows}>
            <button type="button" onClick={() => moveWeek(-1)} aria-label="Semana anterior"><ChevronLeft size={19} /></button>
            <button type="button" onClick={() => moveWeek(1)} disabled={end >= today} aria-label="Próxima semana"><ChevronRight size={19} /></button>
          </div>
        </header>
        <div className={styles.days} role="group" aria-label="Dias da semana">
          {days.map((day) => {
            const key = localDateStr(day)
            const trained = workoutsByDay.has(key)
            const future = key > todayKey
            const dayStatus = query.isSuccess && !future ? (trained ? ', com treino' : ', sem treino registrado') : ''
            return <button type="button" key={key} aria-label={longDate.format(day) + dayStatus} aria-pressed={selected === key}
              aria-current={key === todayKey ? 'date' : undefined} data-trained={trained || undefined}
              disabled={future} onClick={() => setSelected(key)}>
              <small>{weekday.format(day)}</small><strong>{day.getDate()}</strong>
              <span className={styles.mark} aria-hidden="true">{trained ? <Check size={13} strokeWidth={3} /> : '·'}</span>
            </button>
          })}
        </div>
        {query.isSuccess && <p className={styles.weekCount}>
          <Check size={15} aria-hidden="true" /> {trainingDays} {trainingDays === 1 ? 'dia com treino' : 'dias com treino'} na semana
        </p>}
      </div>
      {query.isPending ? <p role="status">Carregando treinos…</p>
        : query.isError ? <p role="alert">Não foi possível carregar os treinos. <button type="button" onClick={() => query.refetch()}>Tentar novamente</button></p>
        : <div className={styles.selectedDay}>
          <h3>{selected === todayKey ? 'Hoje' : longDate.format(parseDate(selected))}</h3>
          {workouts.length ? <ul className={styles.sessions} aria-label="Treinos registrados no dia">
            {workouts.map((workout) => <li key={workout.id}><Link to={'/workouts/view/' + workout.id}>
              <span><Dumbbell size={17} /></span>
              <div><strong>{workout.name}</strong><small>{workout.category || 'Musculação'}{workout.seconds > 0 ? ' · ' + mins(workout.seconds) + ' min' : ''}</small></div>
              <ChevronRight size={16} />
            </Link></li>)}
          </ul> : <p className={styles.empty}>Nenhum treino registrado neste dia.</p>}
          {stats.length > 0 && <dl className={styles.metrics}>{stats.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{fmtNum(value)}</dd></div>)}</dl>}
        </div>}
      <Link className={styles.history} to="/workouts/stats?tab=history">Histórico de treinos <small>{month.format(parseDate(selected))}</small><ChevronRight size={16} /></Link>
    </section>
  )
}
