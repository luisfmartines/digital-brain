import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Clock, History, Maximize2, MoreVertical, Pencil, Play, PlayCircle, Plus, Timer, TrendingUp, Zap } from 'lucide-react'
import {
  useActiveWorkout, useDeleteRoutine, useHistory, useLastPerformed, useRoutines, useStartWorkout, useWeekStats, type Routine,
} from '../../features/workouts/queries'
import { estimateMinutes, fmtNum, mins, muscleLabel, relDays, repsText, weekdayShort } from './helpers'
import styles from './workouts.module.css'

const info = (r: Routine) => ({
  n: r.routine_exercises.length,
  sets: r.routine_exercises.reduce((a, x) => a + x.target_sets, 0),
  muscles: [...new Set(r.routine_exercises.map((x) => muscleLabel(x.exercise.muscle_group)))],
})

export default function TrainingView() {
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const routines = useRoutines().data ?? []
  const last = useLastPerformed().data ?? {}
  const week = useWeekStats().data
  const history = useHistory().data ?? []
  const active = useActiveWorkout().data
  const start = useStartWorkout()
  const remove = useDeleteRoutine()
  const [menuId, setMenuId] = useState<string | null>(null)

  const go = (r?: Routine) => start.mutate(r, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  // A "pronta hoje" é a rotina que você treinou há mais tempo (ou nunca)
  const ready = [...routines].sort((a, b) => (last[a.id] ?? '').localeCompare(last[b.id] ?? ''))[0]
  const f = ready ? info(ready) : null
  const delta = week && week.lastVolume > 0 ? ((week.volume - week.lastVolume) / week.lastVolume) * 100 : null

  return (
    <>
      <div className={styles.topRow}>
        <div>
          <span className={styles.protocol}><i /> PROTOCOL ACTIVE</span>
          <h1 className={styles.h1}>Workouts</h1>
          <span className={styles.sub}>Hypertrophy &amp; Performance Protocol</span>
        </div>
        <button type="button" className={styles.iconBtn} onClick={() => setParams({ tab: 'ranking' })} aria-label="Leaderboards"><TrendingUp size={18} /></button>
      </div>

      <section className={styles.traj}>
        <span className={styles.iconBox}><Zap size={16} /></span>
        <div className={styles.trajText}>
          <strong>Weekly Trajectory</strong>
          <small>{week?.count ?? 0} workouts • {fmtNum(week?.volume ?? 0)} kg vol</small>
        </div>
        {delta !== null && <span className={styles.deltaPill}><TrendingUp size={11} /> {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>}
      </section>

      {active && (
        <button type="button" className={styles.banner} onClick={() => navigate(`/workouts/active/${active.id}`)}>
          <i className={styles.liveDot} /> Workout in progress: <b>{active.name}</b> <span>Resume</span>
        </button>
      )}

      <div className={styles.btnRow}>
        <Link to="/workouts/routines/new" className={styles.createBtn}><Plus size={15} /> Create Routine</Link>
        <button type="button" className={styles.quickBtn} onClick={() => go()} disabled={start.isPending}><Timer size={15} /> Quick Empty</button>
      </div>

      {ready && f && (
        <section className={styles.featured}>
          <div className={styles.rowBetween}>
            <span className={styles.readyPill}><PlayCircle size={12} /> READY TODAY</span>
            <span className={styles.est}><Clock size={12} /> ~{estimateMinutes(ready.routine_exercises)} min</span>
          </div>
          <h2 className={styles.fTitle}>{ready.name}</h2>
          {ready.focus && <span className={styles.fFocus}>{ready.focus}</span>}
          <div className={styles.chipRow}>
            <span className={styles.chip}>{f.n} Exercises</span>
            <span className={styles.chip}>{f.sets} Total Sets</span>
          </div>
          {f.muscles.length > 0 && <span className={styles.chipGreen}>{f.muscles.join(', ')}</span>}
          <ul className={styles.exList}>
            {ready.routine_exercises.slice(0, 3).map((r, i) => (
              <li key={r.id}><span>{i + 1}. {r.exercise.name}</span><b>{r.target_sets} × {repsText(r.reps_min, r.reps_max)}</b></li>
            ))}
          </ul>
          <button type="button" className={styles.startBtn} onClick={() => go(ready)} disabled={start.isPending}>Start Workout <Play size={14} /></button>
        </section>
      )}

      <div className={styles.sectionHead}>
        <span>My Routines <i className={styles.count}>{routines.length}</i></span>
        <Link to="/workouts/routines/new" className={styles.link}>New +</Link>
      </div>

      {routines.length === 0 && <p className={styles.empty}>No routines yet. Create your first one to get a ready-to-go workout here.</p>}

      <ul className={styles.list}>
        {routines.map((r) => {
          const i = info(r)
          return (
            <li key={r.id} className={styles.routine}>
              <div className={styles.rHead}>
                <span className={styles.iconBox}><Maximize2 size={16} /></span>
                <div className={styles.rText}>
                  <strong>{r.name}</strong>
                  <small>{i.muscles.slice(0, 2).join(' & ') || 'No exercises yet'} • {i.n} Exercises • {i.sets} Sets</small>
                </div>
                <Link to={`/workouts/routines/${r.id}/edit`} className={styles.plainBtn} aria-label="Edit routine"><Pencil size={14} /></Link>
                <div className={styles.menuWrap}>
                  <button type="button" className={styles.plainBtn} onClick={() => setMenuId(menuId === r.id ? null : r.id)} aria-label="Routine options"><MoreVertical size={16} /></button>
                  {menuId === r.id && (
                    <div className={styles.menu}>
                      <button type="button" onClick={() => { setMenuId(null); if (window.confirm(`Delete “${r.name}”?`)) remove.mutate(r.id) }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
              {r.tags.length > 0 && <div className={styles.chipRow}>{r.tags.map((t) => <span key={t} className={styles.chipGreen}>{t}</span>)}</div>}
              <div className={styles.rFoot}>
                <span className={styles.last}><History size={13} /> {last[r.id] ? `Last performed ${relDays(last[r.id]).toLowerCase()}` : 'Never performed'}</span>
                <button type="button" className={styles.quickStart} onClick={() => go(r)} disabled={start.isPending}>Quick Start <Play size={12} /></button>
              </div>
            </li>
          )
        })}
      </ul>

      {history.length > 0 && (
        <>
          <div className={styles.sectionHead}>
            <span>Recent History <i className={styles.hintTag}>Synaptic Sync</i></span>
          </div>
          <ul className={styles.list}>
            {history.map((h) => (
              <li key={h.id} className={styles.hItem}>
                <span className={styles.hIcon}><Check size={14} /></span>
                <div className={styles.rText}>
                  <strong>{h.name} <i className={styles.hintTag}>{relDays(h.ended_at)}</i></strong>
                  <small>{mins(h.seconds)} mins • {fmtNum(h.volume)} kg volume</small>
                </div>
                <div className={styles.hRight}><strong>{h.pct}%</strong><small>Completed</small></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}