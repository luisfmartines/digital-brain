import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useRoutine, useSaveRoutine, type Exercise, type Routine } from '../../features/workouts/queries'
import { muscleLabel } from '../../features/workouts/utils'
import ExercisePicker from './ExercisePicker'
import styles from './workouts.module.css'

interface Row { key: string; exercise: Exercise; target_sets: number; reps_min: number | null; reps_max: number | null; rest_seconds: number }
const REST = [45, 60, 90, 120, 180]
const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))) || null)

function RoutineForm({ routine }: { routine?: Routine }) {
  const navigate = useNavigate()
  const save = useSaveRoutine()
  const [name, setName] = useState(routine?.name ?? '')
  const [focus, setFocus] = useState(routine?.focus ?? '')
  const [tags, setTags] = useState((routine?.tags ?? []).join(', '))
  const [rows, setRows] = useState<Row[]>(
    routine?.routine_exercises.map((r) => ({ key: r.id, exercise: r.exercise, target_sets: r.target_sets, reps_min: r.reps_min, reps_max: r.reps_max, rest_seconds: r.rest_seconds })) ?? []
  )
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (key: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const move = (i: number, d: number) =>
    setRows((cur) => {
      const j = i + d
      if (j < 0 || j >= cur.length) return cur
      const next = [...cur]
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })

  function submit() {
    setError(null)
    save.mutate(
      {
        id: routine?.id,
        input: { name: name.trim(), focus: focus.trim() || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) },
        rows: rows.map((r) => ({ exercise_id: r.exercise.id, target_sets: r.target_sets, reps_min: r.reps_min, reps_max: r.reps_max, rest_seconds: r.rest_seconds })),
      },
      { onSuccess: () => navigate('/workouts', { replace: true }), onError: (e) => setError(e.message) }
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft size={22} /></button>
          <h1 className={styles.headerTitle}>{routine ? 'Edit Routine' : 'New Routine'}</h1>
        </header>

        <label className={styles.field}>Routine name
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Push Day A" />
        </label>
        <label className={styles.field}>Focus <small>optional</small>
          <input className={styles.input} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g., Hypertrophy & Upper Chest Focus" />
        </label>
        <label className={styles.field}>Tags <small>comma separated</small>
          <input className={styles.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Warm-up, Working, Drop set" />
        </label>

        <div className={styles.sectionHead}><span>Exercises <i className={styles.count}>{rows.length}</i></span></div>
        <ul className={styles.list}>
          {rows.map((r, i) => (
            <li key={r.key} className={styles.exRow}>
              <div className={styles.rowBetween}>
                <div className={styles.rText}><strong>{r.exercise.name}</strong><small>{muscleLabel(r.exercise.muscle_group)}</small></div>
                <div className={styles.rowBtns}>
                  <button type="button" className={styles.plainBtn} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                  <button type="button" className={styles.plainBtn} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                  <button type="button" className={styles.plainBtn} onClick={() => setRows((c) => c.filter((x) => x.key !== r.key))} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className={styles.ctrlRow}>
                <label>Sets<input className={styles.mini} inputMode="numeric" value={r.target_sets} onChange={(e) => patch(r.key, { target_sets: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} /></label>
                <label>Reps min<input className={styles.mini} inputMode="numeric" value={r.reps_min ?? ''} onChange={(e) => patch(r.key, { reps_min: numOrNull(e.target.value) })} /></label>
                <label>Reps max<input className={styles.mini} inputMode="numeric" value={r.reps_max ?? ''} onChange={(e) => patch(r.key, { reps_max: numOrNull(e.target.value) })} /></label>
                <label>Rest<select className={styles.mini} value={r.rest_seconds} onChange={(e) => patch(r.key, { rest_seconds: Number(e.target.value) })}>
                  {REST.map((s) => <option key={s} value={s}>{s}s</option>)}
                </select></label>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.addExBtn} onClick={() => setPicker(true)}><Plus size={14} /> Add exercise</button>

        {error && <p className={styles.error}>{error}</p>}
        <button type="button" className={styles.primary} onClick={submit} disabled={!name.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Save routine'}</button>
        <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>Cancel</button>
      </div>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(e) => { setRows((c) => [...c, { key: `${e.id}-${Date.now()}`, exercise: e, target_sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90 }]); setPicker(false) }}
        />
      )}
    </div>
  )
}

export default function RoutineFormPage() {
  const { id } = useParams()
  const { data: routine, isLoading } = useRoutine(id)
  if (id && isLoading) return <p style={{ padding: 24 }}>Loading…</p>
  return <RoutineForm key={routine?.id ?? 'new'} routine={routine ?? undefined} />
}