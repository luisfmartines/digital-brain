import { useState } from 'react'
import { ArrowLeft, ChevronRight, Clock, Dumbbell, Pencil, Play } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Splash from '../../components/layout/Splash'
import ChoiceField from '../../components/ui/ChoiceField'
import { useRoutine, useRoutineHistory, useStartWorkout, type RoutineHistoryWorkout } from '../../features/workouts/queries'
import { restLabel, setTypeOf } from '../../features/workouts/setTypes'
import { fmtNum, mins, muscleLabel, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import { SavedExerciseImage } from './ExerciseImage'
import base from './workouts.module.css'
import styles from './workoutExtras.module.css'

const metrics = [
  { id: 'volume', label: 'Volume', unit: 'kg' },
  { id: 'reps', label: 'Repetições', unit: 'reps' },
  { id: 'time', label: 'Duração', unit: 'min' },
] as const
const periods = [
  { value: 30, label: 'Último mês' },
  { value: 90, label: 'Últimos 3 meses' },
  { value: 365, label: 'Último ano' },
] as const
type Metric = typeof metrics[number]
const shortDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

function HistoryChart({ history }: { history: RoutineHistoryWorkout[] }) {
  const [metric, setMetric] = useState<Metric>(metrics[0])
  const [period, setPeriod] = useState<30 | 90 | 365>(90)
  const [selectedId, setSelectedId] = useState<string>()
  const start = new Date()
  start.setDate(start.getDate() - period)
  const range = history.filter((workout) => new Date(workout.ended_at) >= start)
  const points = range.slice(0, 12).reverse().map((workout) => ({
    id: workout.id,
    date: shortDate(workout.ended_at),
    value: metric.id === 'volume' ? volumeOf(workout.workout_sets)
      : metric.id === 'time' ? mins(workoutSeconds({ ...workout, paused_at: null }, 0))
        : workout.workout_sets.reduce((sum, set) => sum + (set.completed ? set.reps ?? 0 : 0), 0),
  }))
  const selected = points.find((point) => point.id === selectedId) ?? points.at(-1)
  const max = Math.max(1, ...points.map((point) => point.value))
  const coordinates = points.map((point, index) => ({ x: (index + .5) * 100 / points.length, y: 94 - 80 * point.value / max }))

  return (
    <section className={styles.routineHistory} aria-labelledby="routine-history">
      <div className={styles.sectionRow}>
        <h2 id="routine-history">Evolução</h2>
        <ChoiceField label="Período" value={period} options={periods} onChange={(value) => { setPeriod(value); setSelectedId(undefined) }} />
      </div>
      <div className={styles.metricTabs} role="group" aria-label="Métrica da rotina">
        {metrics.map((item) => <button type="button" key={item.id} aria-pressed={item.id === metric.id} onClick={() => setMetric(item)}>{item.label}</button>)}
      </div>
      {selected ? (
        <>
          <p className={styles.routineMetric} aria-live="polite"><strong>{fmtNum(selected.value)} <small>{metric.unit}</small></strong><span>{selected.date}</span></p>
          <div className={styles.routinePlot}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.chartGrid} d="M0 14H100 M0 54H100 M0 94H100" />
              {points.length > 1 && <polyline className={styles.chartLine}
                points={coordinates.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} />}
            </svg>
            <div className={styles.chartTargets}>
              {points.map((point, index) => <button key={point.id} type="button" aria-pressed={selected.id === point.id}
                aria-label={`${point.date}, ${fmtNum(point.value)} ${metric.unit}`} onClick={() => setSelectedId(point.id)}>
                <i style={{ top: `${coordinates[index].y}%` }} aria-hidden="true" />
              </button>)}
            </div>
          </div>
          <div className={styles.chartDates}><small>{points[0].date}</small>{points.length > 1 && <small>{points.at(-1)?.date}</small>}</div>
          {range.length > 12 && <small className={styles.chartNote}>Últimos 12 treinos do período</small>}
        </>
      ) : <p className={styles.threadEmpty}>Nenhum treino desta rotina no período.</p>}
    </section>
  )
}

export default function RoutinePreviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routine = useRoutine(id)
  const history = useRoutineHistory(id)
  const start = useStartWorkout()
  if (routine.isLoading) return <Splash />
  const plan = routine.data
  const previous = history.data?.[0]

  return (
    <div className={base.screen}>
      <main className={base.frame}>
        <header className={styles.detailHead}>
          <Link to="/workouts" className={base.back} aria-label="Voltar aos treinos"><ArrowLeft size={20} /></Link>
          <span>Rotina</span>
          {plan && <Link to={`/workouts/routines/${plan.id}/edit`} className={base.routineAction}><Pencil size={15} /> Editar rotina</Link>}
        </header>
        {!plan ? <p className={base.error} role="alert">Não foi possível abrir a rotina. {routine.isError && <button type="button" onClick={() => routine.refetch()}>Tentar novamente</button>}</p> : <>
          <section className={styles.routineIntro}>
            <h1>{plan.name}</h1>
            {plan.focus && <p>{plan.focus}</p>}
            {plan.notes && <p className={styles.routineNotes}>{plan.notes}</p>}
            <button type="button" className={base.startBtn} disabled={start.isPending}
              onClick={() => start.mutate(plan, { onSuccess: (workoutId) => navigate(`/workouts/active/${workoutId}`) })}>
              {start.isPending ? 'Iniciando…' : 'Iniciar treino'} <Play size={17} />
            </button>
            {start.isError && <p role="alert" className={base.error}>Não foi possível iniciar o treino. Tente novamente.</p>}
          </section>
          {history.isLoading ? <p role="status" className={base.empty}>Carregando evolução…</p>
            : history.isError ? <p role="alert" className={base.error}>Não foi possível carregar a evolução. <button type="button" onClick={() => history.refetch()}>Tentar novamente</button></p>
              : <HistoryChart history={history.data ?? []} />}

          <section className={styles.routineExercises} aria-labelledby="routine-exercises">
            <div className={styles.sectionRow}>
              <h2 id="routine-exercises">Exercícios</h2>
              {!!previous && <small>Último treino · {shortDate(previous.ended_at)}</small>}
            </div>
            {!plan.routine_exercises.length && <p className={base.empty}>Esta rotina ainda não tem exercícios.</p>}
            {plan.routine_exercises.map(({ id: rowId, exercise, target_sets, rest_seconds }) => {
              const sets = previous?.workout_sets.filter((set) => set.exercise_id === exercise.id && set.completed)
                .sort((a, b) => a.set_number - b.set_number) ?? []
              return <article className={styles.routineExercise} key={rowId}>
                <Link to={`/workouts/exercises/${exercise.id}`} className={styles.exerciseLink}>
                  <SavedExerciseImage exercise={exercise} fallback={<Dumbbell size={21} />} />
                  <span><strong>{exercise.name}</strong><small>{muscleLabel(exercise.muscle_group)}</small></span>
                  <ChevronRight size={17} />
                </Link>
                <p><Clock size={14} /> {target_sets} {target_sets === 1 ? 'série' : 'séries'} · {rest_seconds > 0 ? `${restLabel(rest_seconds)} de descanso` : 'sem descanso'}</p>
                {sets.length > 0 && <table className={styles.routineSeries} aria-label={`Séries anteriores de ${exercise.name}`}>
                  <thead><tr><th scope="col">Série</th><th scope="col">Peso</th><th scope="col">Repetições</th></tr></thead>
                  <tbody>{sets.map((set) => {
                    const type = setTypeOf(set)
                    return <tr key={set.id}><td title={type.label}>{type.short || set.set_number}</td>
                      <td>{set.weight_kg === null ? '–' : `${set.weight_kg.toLocaleString('pt-BR')} kg`}</td>
                      <td>{set.reps ?? '–'}</td></tr>
                  })}</tbody>
                </table>}
              </article>
            })}
          </section>
        </>}
      </main>
    </div>
  )
}
