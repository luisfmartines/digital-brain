import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrainCircuit, Clock, MoreHorizontal, Pencil, Play, PlayCircle, Timer, TrendingUp } from 'lucide-react'
import FloatingAction from '../../components/ui/FloatingAction'
import ActionSheet from '../../components/ui/ActionSheet'
import { useConfirmation } from '../../components/ui/useConfirmation'
import {
  useActiveWorkout, useDeleteRoutine, useLastPerformed, useRoutines, useStartWorkout, type Routine,
} from '../../features/workouts/queries'
import { SavedExerciseImage } from './ExerciseImage'
import { estimateMinutes, muscleLabel } from './helpers'
import WorkoutTimeline from './WorkoutTimeline'
import styles from './workouts.module.css'

export default function TrainingView() {
  const navigate = useNavigate()
  const routineList = useRoutines()
  const routines = routineList.data ?? []
  const last = useLastPerformed().data ?? {}
  const active = useActiveWorkout().data
  const start = useStartWorkout()
  const remove = useDeleteRoutine()
  const confirmation = useConfirmation()
  const [menuId, setMenuId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const go = (routine?: Routine) => start.mutate(routine, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  const ready = routines.reduce<Routine | undefined>((oldest, routine) =>
    !oldest || (last[routine.id] ?? '') < (last[oldest.id] ?? '') ? routine : oldest, undefined)
  const todayExercises = ready?.routine_exercises ?? []
  const todaySets = todayExercises.reduce((sum, row) => sum + row.target_sets, 0)
  const todayMuscles = [...new Set(todayExercises.map(({ exercise }) => muscleLabel(exercise.muscle_group)))].join(', ')

  return (
    <>
      {active && (
        <button type="button" className={styles.banner} onClick={() => navigate(`/workouts/active/${active.id}`)}>
          <i className={styles.liveDot} />
          <span className={styles.rText}><strong>Treino em andamento</strong><small>{active.name}</small></span>
          <span className={styles.resume}>Retomar</span>
        </button>
      )}

      <WorkoutTimeline />
      <div className={styles.trainingHeading}>
        <h1>Meus treinos</h1>
      </div>

      {start.isError && <p className={styles.error} role="alert">Não foi possível iniciar o treino. Tente novamente.</p>}
      {routineList.isPending && <p className={styles.loading} role="status">Carregando rotinas…</p>}
      {routineList.isError && <p className={styles.error} role="alert">Não foi possível carregar as rotinas. <button type="button" onClick={() => routineList.refetch()}>Tentar novamente</button></p>}
      {routineList.isSuccess && routines.length === 0 && <p className={styles.empty}>Crie uma rotina para salvar os exercícios que você costuma fazer.</p>}

      {ready && (
        <section className={styles.featured} aria-label="Treino de hoje">
          <div className={styles.rowBetween}>
            <span className={styles.readyPill}><PlayCircle size={15} /> Treino de hoje</span>
            <span className={styles.est}><Clock size={13} /> ~{estimateMinutes(todayExercises)} min</span>
          </div>
          <h2><Link className={styles.featuredPreview} to={`/workouts/routines/${ready.id}`}
            aria-label={`Prévia de ${ready.name}`}>{ready.name}</Link></h2>
          {ready.focus && <p className={styles.fFocus}>{ready.focus}</p>}
          <div className={styles.chipRow}>
            <span>{todayExercises.length} {todayExercises.length === 1 ? 'exercício' : 'exercícios'}</span>
            <span>{todaySets} {todaySets === 1 ? 'série' : 'séries'}</span>
            {todayMuscles && <span>{todayMuscles}</span>}
          </div>
          {todayExercises.length > 0 && (
            <ul className={styles.exList}>
              {todayExercises.slice(0, 3).map(({ id, exercise, target_sets }, index) => (
                <li key={id}><span>{index + 1}. {exercise.name}</span><b>{target_sets} {target_sets === 1 ? 'série' : 'séries'}</b></li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.startBtn} onClick={() => go(ready)} disabled={start.isPending}>
            Iniciar treino <Play size={15} />
          </button>
        </section>
      )}

      {routines.length > 0 && (
        <ul className={styles.routineGrid} aria-label="Rotinas de treino">
          {routines.map((routine) => {
            const count = routine.routine_exercises.length
            const isOpen = menuId === routine.id
            return (
              <li key={routine.id} className={styles.routine}>
                <div className={styles.rHead}>
                  <div className={styles.routinePreviews} aria-hidden="true">
                    {routine.routine_exercises.slice(0, 2).map(({ id, exercise }) => (
                      <span key={id} className={styles.routineThumb}><SavedExerciseImage exercise={exercise} fallback={null} /></span>
                    ))}
                  </div>
                  <div className={styles.menuWrap}
                    onBlur={(event) => {
                      if (isOpen && !event.currentTarget.contains(event.relatedTarget)) setMenuId(null)
                    }}
                    onKeyDown={(event) => {
                      if (isOpen && event.key === 'Escape') {
                        event.stopPropagation()
                        setMenuId(null)
                        event.currentTarget.querySelector('button')?.focus()
                      }
                    }}>
                    <button type="button" className={styles.routineMenu} aria-label={`Opções de ${routine.name}`} aria-expanded={isOpen}
                      onClick={() => setMenuId((id) => id === routine.id ? null : routine.id)}><MoreHorizontal size={20} /></button>
                    {isOpen && (
                      <div className={styles.routineMenuItems}>
                        <Link to={`/workouts/routines/${routine.id}/edit`}><Pencil size={14} /> Editar rotina</Link>
                        <button type="button" onClick={() => {
                          setMenuId(null)
                          confirmation.ask({ title: 'Excluir rotina?', description: routine.name, danger: true, confirmLabel: 'Excluir rotina',
                            onConfirm: () => remove.mutate(routine.id) })
                        }}>Excluir rotina</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.routineInfo}>
                  <h2 aria-label={routine.name}>
                    <Link className={styles.routinePreviewHit} to={`/workouts/routines/${routine.id}`}
                      aria-label={`Pré-visualizar ${routine.name}`}>{routine.name}</Link>
                  </h2>
                  <small>{count} {count === 1 ? 'exercício' : 'exercícios'}</small>
                </div>
                <button type="button" className={`${styles.routineAction} ${styles.quickStart}`} onClick={() => go(routine)}
                  disabled={start.isPending} aria-label={`Iniciar ${routine.name}`}><Play size={14} /> Iniciar</button>
              </li>
            )
          })}
        </ul>
      )}

      {confirmation.dialog}
      {remove.isError && <p role="alert" className={styles.error}>Não foi possível excluir a rotina.</p>}

      <div className={styles.trainingTools}>
        <button type="button" className={styles.routineAction} onClick={() => go()} disabled={start.isPending}>
          <Timer size={15} /> Iniciar treino vazio
        </button>
        <Link to="/workouts/stats?tab=charts" className={styles.routineAction}><TrendingUp size={15} /> Estatísticas</Link>
      </div>

      <FloatingAction label="Criar rotina" onClick={() => setCreating(true)} />
      {creating && <ActionSheet title="Nova rotina" onClose={() => setCreating(false)}>
        <Link to="/workouts/routines/new"><Pencil size={21} /><span><strong>Montar minha rotina</strong><small>Escolha os exercícios e as séries.</small></span></Link>
        <Link to="/assistant" state={{ prompt: 'Quero montar uma rotina de treino. Antes de criar, pergunte meu objetivo, experiência e quantos dias posso treinar.' }}>
          <BrainCircuit size={21} /><span><strong>Montar com o Neural</strong><small>Monte uma rotina a partir do seu objetivo.</small></span>
        </Link>
      </ActionSheet>}
    </>
  )
}
