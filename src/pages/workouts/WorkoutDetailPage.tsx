import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useWorkoutDetail, type WorkoutDetailSet } from '../../features/social/queries'
import { fmtNum, mins, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import styles from './workouts.module.css'

const kg = (n: number | null) => (n === null ? '—' : `${Number(n.toFixed(2))} kg`)

// Treino completo de um post do feed (somente leitura): exercícios, séries, peso e repetições
export default function WorkoutDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: w, isLoading, error } = useWorkoutDetail(id)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/?tab=feed', { replace: true }))

  if (isLoading) return <p className={styles.loading}>Loading…</p>
  if (error) return <p className={styles.loading}>Could not load this workout.</p>
  if (!w) return <Navigate to="/?tab=feed" replace />

  const logged = w.sets.filter((s) => s.completed)
  const groups = new Map<string, { name: string; order: number; sets: WorkoutDetailSet[] }>()
  for (const s of logged) {
    const g = groups.get(s.exercise_id) ?? { name: s.exercise?.name ?? 'Exercise', order: s.exercise_order, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_id, g)
  }
  const exercises = [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ ...g, sets: [...g.sets].sort((a, b) => a.set_number - b.set_number) }))

  const volume = volumeOf(w.sets)
  const secs = workoutSeconds({ ...w, paused_at: null }, 0)
  const date = new Date(w.ended_at ?? w.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.detHead}>
          <button type="button" className={styles.back} onClick={back} aria-label="Back"><ArrowLeft size={20} /></button>
          <Avatar url={w.author?.avatar_url} name={w.author?.display_name} size={34} />
          <div className={styles.detWho}>
            <strong>{w.name}</strong>
            <small>{w.author?.display_name ?? 'Athlete'} • {date}</small>
          </div>
        </header>

        <div className={styles.detStats}>
          <div className={styles.detStat}><small>Duration</small><strong>{mins(secs)} <i>min</i></strong></div>
          <div className={styles.detStat}><small>Volume</small><strong>{fmtNum(volume)} <i>kg</i></strong></div>
          <div className={styles.detStat}><small>Sets</small><strong>{logged.length}</strong></div>
        </div>

        {w.photo_url && <img className={styles.detPhoto} src={w.photo_url} alt="" />}

        <section className={styles.panel}>
          {exercises.length === 0 && <p className={styles.empty}>No sets were logged in this workout.</p>}
          {exercises.map((ex) => (
            <div key={ex.sets[0].exercise_id} className={styles.detEx}>
              <div className={styles.detExHead}>
                <strong>{ex.name}</strong>
                <small>{ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}</small>
              </div>
              <table className={styles.detTable}>
                <thead><tr><th>SET</th><th>WEIGHT &amp; REPS</th></tr></thead>
                <tbody>
                  {ex.sets.map((s, i) => (
                    <tr key={s.id}>
                      <td>{s.is_warmup ? <span className={styles.detWarm}>W</span> : ex.sets.slice(0, i).filter((x) => !x.is_warmup).length + 1}</td>
                      <td>{s.weight_kg ? `${kg(s.weight_kg)} x ${s.reps ?? '—'}` : `${s.reps ?? '—'} reps`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
