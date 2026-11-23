import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Clock, FastForward, Flag, Hourglass, Maximize2, MoreVertical, Pause, Play, Plus, Vibrate, Volume2, VolumeX, X } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import { usePrevious, useRoutine, useSession, useSessionActions, type Exercise, type SessionSet } from '../../features/workouts/queries'
import { fmtClock, fmtNum, muscleLabel, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import ExercisePicker from './ExercisePicker'
import styles from './workouts.module.css'

interface Group { exercise: Exercise; order: number; sets: SessionSet[] }

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.1
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // navegador sem áudio
  }
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

interface RowProps {
  set: SessionSet
  label: number
  previous?: { weight_kg: number | null; reps: number | null }
  current: boolean
  onCommit: (patch: { weight_kg: number | null; reps: number | null }) => void
  onToggle: (weight: number | null, reps: number | null) => void
  onCycle: () => void
}

function SetRow({ set, label, previous, current, onCommit, onToggle, onCycle }: RowProps) {
  const [w, setW] = useState(set.weight_kg === null ? '' : String(set.weight_kg))
  const [r, setR] = useState(set.reps === null ? '' : String(set.reps))
  const num = (v: string) => {
    const n = Number(v.replace(',', '.'))
    return v.trim() === '' || !Number.isFinite(n) ? null : n
  }
  const commit = () => {
    const wn = num(w)
    const rn = num(r)
    if (wn !== set.weight_kg || rn !== set.reps) onCommit({ weight_kg: wn, reps: rn })
  }

  return (
    <div className={`${styles.setRow} ${current ? styles.setCurrent : ''} ${set.completed ? styles.setDone : ''}`}>
      <button type="button" className={set.is_warmup ? styles.setNumW : styles.setNum} onClick={onCycle} aria-label="Toggle warm-up">{set.is_warmup ? 'W' : label}</button>
      <span className={styles.prev}>{previous ? `${previous.weight_kg ?? 0}kg × ${previous.reps ?? 0}` : '—'}</span>
      <input className={styles.numInput} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} aria-label="Weight in kg" />
      <input className={styles.numInput} inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} onBlur={commit} aria-label="Reps" />
      <button type="button" className={set.completed ? styles.checkOn : styles.check} onClick={() => onToggle(num(w), num(r))} aria-label="Mark set as done"><Check size={14} /></button>
    </div>
  )
}

export default function ActiveWorkoutPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: session, isLoading } = useSession(id)
  const routine = useRoutine(session?.routine_id ?? undefined)
  const actions = useSessionActions(id)

  const [now, setNow] = useState(() => Date.now())
  const [rest, setRest] = useState<{ endsAt: number; label: string } | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [picker, setPicker] = useState(false)
  const [menuEx, setMenuEx] = useState<string | null>(null)
  const [vibrate, setVibrate] = useState(true)
  const [sound, setSound] = useState(true)

  const exerciseIds = useMemo(() => [...new Set((session?.workout_sets ?? []).map((s) => s.exercise_id))], [session])
  const previous = usePrevious(exerciseIds)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (rest && now >= rest.endsAt) {
      if (vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200])
      if (sound) beep()
      setRest(null)
    }
  }, [now, rest, vibrate, sound])

  if (isLoading) return <p className={styles.loading}>Loading…</p>
  if (!session) return <Navigate to="/workouts" replace />
  if (session.ended_at) return <Navigate to={`/workouts/summary/${id}`} replace />

  const sets = [...session.workout_sets].sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number)
  const groups: Group[] = []
  for (const s of sets) {
    let g = groups.find((x) => x.exercise.id === s.exercise_id)
    if (!g) {
      g = { exercise: s.exercise, order: s.exercise_order, sets: [] }
      groups.push(g)
    }
    g.sets.push(s)
  }

  const done = sets.filter((s) => s.completed)
  const currentGroup = groups.find((g) => g.sets.some((s) => !s.completed))
  const currentSetId = currentGroup?.sets.find((s) => !s.completed)?.id
  const restFor = (exId: string) => routine.data?.routine_exercises.find((r) => r.exercise.id === exId)?.rest_seconds ?? 90
  const targetFor = (exId: string) => routine.data?.routine_exercises.find((r) => r.exercise.id === exId)?.target_sets
  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  function toggleSet(g: Group, s: SessionSet, weight: number | null, reps: number | null) {
    const completed = !s.completed
    actions.updateSet.mutate({ setId: s.id, patch: { completed, weight_kg: weight, reps } })
    if (completed && !s.is_warmup) {
      const next = g.sets.find((x) => x.set_number > s.set_number && !x.completed)
      setRest({
        endsAt: Date.now() + restFor(g.exercise.id) * 1000,
        label: next
          ? `Resting Set ${s.set_number} • Next: ${next.weight_kg ?? weight ?? 0} kg × ${next.reps ?? reps ?? 0} reps`
          : `Resting after the last set of ${g.exercise.name}`,
      })
    }
  }

  function addSet(g: Group) {
    const lastSet = g.sets[g.sets.length - 1]
    actions.addSet.mutate({
      exerciseId: g.exercise.id, order: g.order, setNumber: (lastSet?.set_number ?? 0) + 1,
      weight: lastSet?.weight_kg ?? null, reps: lastSet?.reps ?? null,
    })
  }

  function finish() {
    if (done.length === 0) {
      window.alert('Complete at least one set, or discard the workout with the X button.')
      return
    }
    if (!window.confirm('Finish this workout?')) return
    actions.finish.mutate(session!, { onSuccess: () => navigate(`/workouts/summary/${id}`, { replace: true }) })
  }

  function discard() {
    if (!window.confirm('Discard this workout? Nothing will be saved.')) return
    actions.discard.mutate(undefined, { onSuccess: () => navigate('/workouts', { replace: true }) })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/workouts')} aria-label="Back"><ArrowLeft size={20} /></button>
          <img src="/icons/icon-192.png" alt="" className={styles.miniLogo} />
          <h1 className={styles.headerTitle}>Active Workout</h1>
          <button type="button" className={styles.back} onClick={discard} aria-label="Discard workout"><X size={20} /></button>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={30} />
        </header>

        <section className={styles.sessionHead}>
          <div className={styles.sessionTitle}>
            <i className={styles.liveDot} />
            <div><span className={styles.cap}>ACTIVE SESSION</span><h2>{session.name}</h2></div>
          </div>
          <div className={styles.sessionBtns}>
            <button type="button" className={styles.pauseBtn} onClick={() => actions.pause.mutate(session)} aria-label={session.paused_at ? 'Resume' : 'Pause'}>
              {session.paused_at ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button type="button" className={styles.finishBtn} onClick={finish}>Finish <Flag size={14} /></button>
          </div>
        </section>

        <section className={styles.statsBar}>
          <div><span className={styles.cap}><Clock size={11} /> TIME</span><strong>{fmtClock(workoutSeconds(session, now))}</strong></div>
          <div><span className={styles.cap}><Check size={11} /> SETS</span><strong>{done.length}<small>/{sets.length}</small></strong></div>
          <div><span className={styles.cap}><Maximize2 size={11} /> VOLUME</span><strong>{fmtNum(volumeOf(sets))}<small>kg</small></strong></div>
        </section>

        {groups.length === 0 && <p className={styles.empty}>Empty workout. Add your first exercise below.</p>}

        {groups.map((g) => {
          const isOpen = open[g.exercise.id] ?? g.exercise.id === currentGroup?.exercise.id
          const target = targetFor(g.exercise.id)
          let workingIndex = 0
          return (
            <section key={g.exercise.id} className={styles.exCard}>
              <div className={styles.exHead} onClick={() => setOpen((o) => ({ ...o, [g.exercise.id]: !isOpen }))}>
                <span className={styles.iconBox}><Maximize2 size={16} /></span>
                <div className={styles.rText}>
                  <div className={styles.tagRow}>
                    <span className={styles.muscleTag}>{muscleLabel(g.exercise.muscle_group).toUpperCase()}</span>
                    {target && <small>Target: {target} Sets</small>}
                  </div>
                  <strong>{g.exercise.name}</strong>
                </div>
                {!isOpen && <small className={styles.planned}>{g.sets.length} sets planned</small>}
                <div className={styles.menuWrap} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={styles.plainBtn} onClick={() => setMenuEx(menuEx === g.exercise.id ? null : g.exercise.id)} aria-label="Exercise options">
                    {isOpen ? <MoreVertical size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {menuEx === g.exercise.id && (
                    <div className={styles.menu}>
                      <button type="button" onClick={() => { setMenuEx(null); actions.removeExercise.mutate(g.exercise.id) }}>Remove exercise</button>
                    </div>
                  )}
                </div>
              </div>

              {isOpen && (
                <>
                  <div className={styles.setHead}><span>SET</span><span>PREVIOUS</span><span>KG</span><span>REPS</span><span>DONE</span></div>
                  {g.sets.map((s) => {
                    if (!s.is_warmup) workingIndex++
                    return (
                      <SetRow
                        key={s.id}
                        set={s}
                        label={workingIndex}
                        previous={previous.data?.get(g.exercise.id)?.find((p) => p.set_number === s.set_number)}
                        current={s.id === currentSetId}
                        onCommit={(patch) => actions.updateSet.mutate({ setId: s.id, patch })}
                        onToggle={(w, r) => toggleSet(g, s, w, r)}
                        onCycle={() => actions.updateSet.mutate({ setId: s.id, patch: { is_warmup: !s.is_warmup } })}
                      />
                    )
                  })}
                  <button type="button" className={styles.addSet} onClick={() => addSet(g)}><Plus size={14} /> Add Set</button>
                </>
              )}
            </section>
          )
        })}

        <button type="button" className={styles.addExBtn} onClick={() => setPicker(true)}><Plus size={14} /> Add exercise</button>
        <div style={{ height: rest ? 190 : 24 }} />
      </div>

      {rest && (
        <section className={styles.rest}>
          <div className={styles.rowBetween}>
            <span className={styles.restKicker}><i /> REST RECOVERY</span>
            <span className={styles.restIcons}>
              <button type="button" className={vibrate ? styles.restOn : ''} onClick={() => setVibrate((v) => !v)} aria-label="Vibration"><Vibrate size={15} /></button>
              <button type="button" className={sound ? styles.restOn : ''} onClick={() => setSound((v) => !v)} aria-label="Sound">{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
            </span>
          </div>
          <div className={styles.restMain}>
            <div><strong className={styles.restTime}>{mmss(remaining)}</strong><small>{rest.label}</small></div>
            <span className={styles.hourglass}><Hourglass size={22} /></span>
          </div>
          <div className={styles.restBtns}>
            <button type="button" onClick={() => setRest({ ...rest, endsAt: rest.endsAt - 15000 })}>−15s</button>
            <button type="button" onClick={() => setRest({ ...rest, endsAt: rest.endsAt + 30000 })}>+30s</button>
            <button type="button" className={styles.skip} onClick={() => setRest(null)}>Skip Rest <FastForward size={14} /></button>
          </div>
        </section>
      )}

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(e) => {
            const exists = groups.find((g) => g.exercise.id === e.id)
            if (!exists) actions.addExercise.mutate({ exerciseId: e.id, order: (groups[groups.length - 1]?.order ?? -1) + 1 })
            setPicker(false)
          }}
        />
      )}
    </div>
  )
}