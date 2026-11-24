import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useRoutine, useSaveRoutine, type Exercise, type Routine } from '../../features/workouts/queries'
import { muscleLabel } from '../../features/workouts/utils'
import ExercisePicker from './ExercisePicker'
import styles from './workouts.module.css'
import { parseSetCount } from '../../features/workouts/routineInput'

interface Row { key: string; exercise: Exercise; target_sets: string; rest_seconds: number }
const REST = [45, 60, 90, 120, 180]

function RoutineForm({ routine }: { routine?: Routine }) {
  const navigate = useNavigate()
  const save = useSaveRoutine()
  const [name, setName] = useState(routine?.name ?? '')
  const [focus, setFocus] = useState(routine?.focus ?? '')
  const [tags, setTags] = useState((routine?.tags ?? []).join(', '))
  const [rows, setRows] = useState<Row[]>(
    routine?.routine_exercises.map((r) => ({ key: r.id, exercise: r.exercise, target_sets: String(r.target_sets), rest_seconds: r.rest_seconds })) ?? []
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
    if (rows.some((r) => parseSetCount(r.target_sets) === null)) {
      setError('Informe um número inteiro de 1 a 10 séries para cada exercício.')
      return
    }
    save.mutate(
      {
        id: routine?.id,
        input: { name: name.trim(), focus: focus.trim() || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) },
        rows: rows.map((r) => ({ exercise_id: r.exercise.id, target_sets: parseSetCount(r.target_sets)!, rest_seconds: r.rest_seconds })),
      },
      { onSuccess: () => navigate('/workouts', { replace: true }), onError: (e) => setError(e.message) }
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Voltar"><ChevronLeft size={22} /></button>
          <h1 className={styles.headerTitle}>{routine ? 'Editar rotina' : 'Nova rotina'}</h1>
        </header>

        <label className={styles.field}>Nome da rotina
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Treino A - Empurrar" />
        </label>
        <label className={styles.field}>Foco <small>opcional</small>
          <input className={styles.input} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex.: Hipertrofia e peito superior" />
        </label>
        <label className={styles.field}>Etiquetas <small>separadas por vírgula</small>
          <input className={styles.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Aquecer, Trabalhar, Série em drop" />
        </label>

        <div className={styles.sectionHead}><span>Exercícios <i className={styles.count}>{rows.length}</i></span></div>
        <ul className={styles.list}>
          {rows.map((r, i) => (
            <li key={r.key} className={styles.exRow}>
              <div className={styles.rowBetween}>
                <div className={styles.rText}><strong>{r.exercise.name}</strong><small>{muscleLabel(r.exercise.muscle_group)}</small></div>
                <div className={styles.rowBtns}>
                  <button type="button" className={styles.plainBtn} onClick={() => move(i, -1)} aria-label="Mover para cima"><ArrowUp size={15} /></button>
                  <button type="button" className={styles.plainBtn} onClick={() => move(i, 1)} aria-label="Mover para baixo"><ArrowDown size={15} /></button>
                  <button type="button" className={styles.plainBtn} onClick={() => setRows((c) => c.filter((x) => x.key !== r.key))} aria-label="Remover"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className={styles.ctrlRow}>
                <label>Séries<input className={styles.mini} inputMode="numeric" value={r.target_sets} onFocus={(e) => e.currentTarget.select()} onChange={(e) => patch(r.key, { target_sets: e.target.value })} aria-invalid={r.target_sets !== '' && parseSetCount(r.target_sets) === null} /></label>
                <label>Descanso<select className={styles.mini} value={r.rest_seconds} onChange={(e) => patch(r.key, { rest_seconds: Number(e.target.value) })}>
                  {REST.map((s) => <option key={s} value={s}>{s}s</option>)}
                </select></label>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.addExBtn} onClick={() => setPicker(true)}><Plus size={14} /> Adicionar exercício</button>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="button" className={styles.primary} onClick={submit} disabled={!name.trim() || save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar rotina'}</button>
        <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>Cancelar</button>
      </div>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(e) => { setRows((c) => [...c, { key: `${e.id}-${Date.now()}`, exercise: e, target_sets: '3', rest_seconds: 90 }]); setPicker(false) }}
        />
      )}
    </div>
  )
}

export default function RoutineFormPage() {
  const { id } = useParams()
  const { data: routine, isLoading, refetch } = useRoutine(id)
  if (id && isLoading) return <p className={styles.loading}>Carregando rotina…</p>
  if (id && !routine) return (
    <section className={styles.frame}>
      <p role="alert" className={styles.error}>Não foi possível abrir esta rotina.</p>
      <button type="button" className={styles.addExBtn} onClick={() => refetch()}>Tentar novamente</button>
      <Link to="/workouts">Voltar para treinos</Link>
    </section>
  )
  return <RoutineForm key={routine?.id ?? 'new'} routine={routine ?? undefined} />
}
