import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useDevice } from '../../expo/device'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Clock, FastForward, Flag, Hourglass, Maximize2, MoreVertical, Pause, Play, Plus, Trash2, Vibrate, Volume2, VolumeX, X } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import ChoiceField from '../../components/ui/ChoiceField'
import Dialog from '../../components/ui/Dialog'
import { useConfirmation } from '../../components/ui/useConfirmation'
import dialogStyles from '../../components/ui/Dialog.module.css'
import { SET_TYPES, REST_OPTIONS, MAX_REST_SECONDS, isPreparation, normalizeRest, setTypeOf, type SetType } from '../../features/workouts/setTypes'
import { useProfile } from '../../features/profile/useProfile'
import { usePrevious, useRoutine, useSession, useSessionActions, type Exercise, type SessionSet } from '../../features/workouts/queries'
import { fmtClock, fmtNum, muscleLabel, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import { useExerciseLink, useExerciseMedia } from '../../features/exercisedb/queries'
import ExercisePicker from './ExercisePicker'
import ExerciseDetail from './ExerciseDetail'
import ExerciseImage, { CustomExercisePhoto } from './ExerciseImage'
import { ExerciseDemo, ExerciseInstructions } from './ExerciseGuidance'
import styles from './workouts.module.css'

interface Group { exercise: Exercise; order: number; sets: SessionSet[] }
const groupKey = (g: Group) => `${g.order}:${g.exercise.id}`

const restStorageKey = (id: string) => 'workout-rest:' + id

function readRestDurations(id: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(restStorageKey(id)) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

function storeRestDurations(id: string, durations?: Record<string, number>) {
  try {
    if (durations) localStorage.setItem(restStorageKey(id), JSON.stringify(durations))
    else localStorage.removeItem(restStorageKey(id))
  } catch {
    // A edição continua disponível na tela se o navegador bloquear o armazenamento.
  }
}

function RestDurationField({ seconds, onApply }: { seconds: number; onApply: (value: number) => void }) {
  return (
    <div className={styles.restDurationField}>
      <span>Descanso entre séries</span>
      <ChoiceField label="Descanso entre séries" value={seconds} options={REST_OPTIONS} onChange={onApply} />
    </div>
  )
}

function ActiveExerciseThumbnail({ exercise }: { exercise: Exercise }) {
  const link = useExerciseLink(exercise.id)
  const media = useExerciseMedia(link.data)
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const demo = media.data
  const thumbnail = styles.iconBox + ' ' + styles.activeThumbnail
  const icon = <Maximize2 size={16} aria-hidden="true" />
  if (!link.data || !demo || (!demo.imageUrl && !demo.videoUrl)) return <span className={thumbnail}>{icon}</span>

  return (
    <>
      <button type="button" className={thumbnail} aria-haspopup="dialog" aria-label={'Ampliar demonstração de ' + exercise.name}
        onClick={() => { dialog.current?.showModal(); setOpen(true) }}>
        {demo.imageUrl ? (
          <ExerciseImage src={demo.imageUrl} externalId={link.data} name={exercise.name} fallback={icon} />
        ) : <video src={demo.videoUrl ?? undefined} autoPlay loop muted playsInline aria-hidden="true" />}
      </button>
      <dialog ref={dialog} className={styles.demoPreview} aria-label={'Demonstração de ' + exercise.name}
        onClose={() => setOpen(false)} onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}>
        <div className={styles.demoPreviewHeader}>
          <h2>{exercise.name}</h2>
          <button type="button" className={styles.plainBtn} aria-label="Fechar demonstração"
            onClick={() => dialog.current?.close()}><X size={22} /></button>
        </div>
        {open && <ExerciseDemo video={demo.imageUrl ? null : demo.videoUrl} image={demo.imageUrl}
          name={exercise.name} externalId={link.data} className={styles.demoPreviewMedia} />}
      </dialog>
    </>
  )
}

function ActiveGuidance({ exercise, onDetails }: { exercise: Exercise; onDetails: () => void }) {
  const link = useExerciseLink(exercise.id)
  const media = useExerciseMedia(link.data)
  if (link.isLoading || media.isLoading) return <p className={styles.empty}>Carregando demonstração…</p>
  if (!link.data || !media.data) return (
    <button type="button" className={styles.addSet} onClick={onDetails}>
      {link.isError || media.isError ? 'Abrir detalhes da demonstração' : 'Ver detalhes e adicionar demonstração'}
    </button>
  )
  return (
    <div className={styles.activeGuidance}>
      <details>
        <summary>Instruções de execução</summary>
        <ExerciseInstructions media={media.data} linked loading={false} failed={false} />
      </details>
    </div>
  )
}

function FinishOptions({ name, busy, error, onClose, onFinish }: {
  name: string; busy: boolean; error: boolean; onClose: () => void; onFinish: (update: boolean) => void
}) {
  return (
    <Dialog title="Atualizar a rotina?" busy={busy} onClose={onClose}>
      <p className={dialogStyles.description}>Seu treino será registrado com as alterações. Você quer aplicá-las à rotina {name} para os próximos treinos?</p>
      {error && <p role="alert">Não foi possível finalizar o treino. Tente novamente.</p>}
      <button type="button" className={dialogStyles.button + ' ' + dialogStyles.primary} disabled={busy} onClick={() => onFinish(true)}>Atualizar rotina</button>
      <button type="button" className={dialogStyles.button} disabled={busy} onClick={() => onFinish(false)}>Manter rotina original</button>
      <button type="button" className={dialogStyles.button} disabled={busy} onClick={onClose}>Voltar ao treino</button>
    </Dialog>
  )
}

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
  onTypeChange: (type: SetType) => void
  onRemove: () => void
  busy: boolean
}

function SetRow({ set, label, previous, current, onCommit, onToggle, onTypeChange, onRemove, busy }: RowProps) {
  const [w, setW] = useState(set.weight_kg === null ? '' : String(set.weight_kg))
  const [r, setR] = useState(set.reps === null ? '' : String(set.reps))
  const gesture = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState(0)
  const type = setTypeOf(set)

  function start(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false
    if (busy || !event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest('dialog'))) return
    if (event.pointerType === 'mouse' && event.target instanceof Element && event.target.closest('input, button')) return
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const tracking = gesture.current
    if (!tracking || tracking.id !== event.pointerId) return
    const dx = event.clientX - tracking.x
    const dy = event.clientY - tracking.y
    if (!tracking.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return }
      if (dx > -10 || -dx <= Math.abs(dy)) return
      tracking.dragging = true
      suppressClick.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setOffset(Math.max(-96, Math.min(0, dx)))
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    const tracking = gesture.current
    if (!tracking || tracking.id !== event.pointerId) return
    gesture.current = null
    setOffset(0)
    if (event.type === 'pointerup' && tracking.dragging && event.clientX - tracking.x <= -64) onRemove()
  }

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
    <div className={styles.swipeSet} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onLostPointerCapture={(event) => { if (event.target === event.currentTarget) end(event) }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }
      }}>
      <span hidden={offset === 0} className={styles.swipeDelete} aria-hidden="true"><Trash2 size={16} /></span>
      <div style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        className={`${styles.setRow} ${current ? styles.setCurrent : ''} ${set.completed ? styles.setDone : ''}`}>
        <ChoiceField label="Tipo da série" value={type.value} options={SET_TYPES} onChange={onTypeChange} disabled={busy}
          className={styles.setIndex + ' ' + (type.short ? styles.setNumW : styles.setNum)}
          compactText={type.short || label} />
        <span className={styles.prev}><span className={styles.setFieldLabel}>Anterior</span>{previous ? `${previous.weight_kg ?? 0}kg × ${previous.reps ?? 0}` : '—'}</span>
        <label className={styles.setWeight}>
          <span className={styles.setFieldLabel}>Peso (kg)</span>
          <input className={styles.numInput} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} aria-label="Peso em kg" />
        </label>
        <label className={styles.setReps}>
          <span className={styles.setFieldLabel}>Repetições</span>
          <input className={styles.numInput} inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} onBlur={commit} aria-label="Repetições" />
        </label>
        <button type="button" className={styles.setComplete + ' ' + (set.completed ? styles.checkOn : styles.check)} onClick={() => onToggle(num(w), num(r))} aria-label={set.completed ? 'Desmarcar série concluída' : 'Marcar série como concluída'}><Check size={14} /></button>
        <button type="button" className={styles.removeSet} aria-label={`Remover série ${set.set_number}`} disabled={busy} onClick={onRemove}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export default function ActiveWorkoutPage() {
  const { id = '' } = useParams()
  return <ActiveWorkoutSession key={id} id={id} />
}

function ActiveWorkoutSession({ id }: { id: string }) {
  const vibrateDevice = useDevice()?.vibrate
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: session, isLoading, isError, refetch } = useSession(id)
  const routine = useRoutine(session?.routine_id ?? undefined)
  const actions = useSessionActions(id)
  const confirmation = useConfirmation()

  const [now, setNow] = useState(() => Date.now())
  const [rest, setRest] = useState<{ group: string; endsAt: number; label: string } | null>(null)
  const [restDurations, setRestDurations] = useState(() => readRestDurations(id))
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [picker, setPicker] = useState<Group | 'add' | null>(null)
  const [pickerError, setPickerError] = useState('')
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [askingToUpdate, setAskingToUpdate] = useState(false)
  const [menuEx, setMenuEx] = useState<string | null>(null)
  const [vibrate, setVibrate] = useState(true)
  const [sound, setSound] = useState(true)

  const exerciseIds = useMemo(() => [...new Set((session?.workout_sets ?? []).map((s) => s.exercise_id))], [session])
  const previous = usePrevious(exerciseIds)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const restEndsAt = rest?.endsAt
  useEffect(() => {
    if (restEndsAt == null) return
    const timer = window.setTimeout(() => {
      if (vibrate) {
        if (vibrateDevice) void vibrateDevice()
        else navigator.vibrate?.([200, 100, 200])
      }
      if (sound) beep()
      setRest(null)
    }, Math.max(0, restEndsAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [restEndsAt, vibrate, sound, vibrateDevice])

  if (isLoading) return <p className={styles.loading}>Carregando…</p>
  if (isError && !session) return (
    <section className={styles.frame}>
      <p role="alert" className={styles.error}>Não foi possível abrir o treino em andamento.</p>
      <button type="button" className={styles.addExBtn} onClick={() => refetch()}>Tentar novamente</button>
      <Link to="/workouts">Voltar para treinos</Link>
    </section>
  )
  if (!session) return <Navigate to="/workouts" replace />
  if (session.ended_at) return <Navigate to={`/workouts/summary/${id}`} replace />

  const sets = [...session.workout_sets].sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number)
  const groups: Group[] = []
  for (const s of sets) {
    let g = groups.find((x) => x.order === s.exercise_order && x.exercise.id === s.exercise_id)
    if (!g) {
      g = { exercise: s.exercise, order: s.exercise_order, sets: [] }
      groups.push(g)
    }
    g.sets.push(s)
  }

  const done = sets.filter((s) => s.completed)
  const currentGroup = groups.find((g) => g.sets.some((s) => !s.completed))
  const currentSetId = currentGroup?.sets.find((s) => !s.completed)?.id
  const plan = routine.data?.routine_exercises
  const planFor = (g: Group) => plan?.[g.order]
  const restFor = (g: Group) => normalizeRest(restDurations[groupKey(g)] ?? planFor(g)?.rest_seconds ?? 90)

  function changeRest(g: Group, seconds: number) {
    const key = groupKey(g)
    const changeMs = (seconds - restFor(g)) * 1000
    const durations = { ...restDurations, [key]: seconds }
    setRestDurations(durations)
    storeRestDurations(id, durations)
    setNow(Date.now())
    setRest((current) => {
      if (current?.group !== key) return current
      return { ...current, endsAt: Math.min(current.endsAt + changeMs, Date.now() + MAX_REST_SECONDS * 1000) }
    })
  }
  const changed = !!plan && (plan.length !== groups.length || groups.some((g, i) =>
    g.exercise.id !== plan[i].exercise.id || g.sets.length !== plan[i].target_sets
  ))
  const editing = actions.addSet.isPending || actions.removeSet.isPending || actions.addExercise.isPending ||
    actions.removeExercise.isPending || actions.replaceExercise.isPending
  const busy = editing || actions.finish.isPending || actions.discard.isPending
  const editFailed = actions.addSet.isError || actions.removeSet.isError || actions.removeExercise.isError ||
    actions.discard.isError || (actions.updateSet.isError && !actions.updateSet.isPending)
  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  function toggleSet(g: Group, s: SessionSet, weight: number | null, reps: number | null) {
    const completed = !s.completed
    actions.updateSet.mutate({ setId: s.id, patch: { completed, weight_kg: weight, reps } })
    const seconds = restFor(g)
    if (completed) {
      const startedAt = Date.now()
      setNow(startedAt)
      const next = g.sets.find((x) => x.set_number > s.set_number && !x.completed)
      setRest({
        group: groupKey(g),
        endsAt: startedAt + seconds * 1000,
        label: next
          ? 'Descansando após a série ' + s.set_number + ' • Próxima série: ' + next.set_number
          : `Descansando após a última série de ${g.exercise.name}`,
      })
    }
  }

  function addSet(g: Group) {
    const lastSet = g.sets[g.sets.length - 1]
    actions.addSet.mutate({
      exerciseId: g.exercise.id, order: g.order, setNumber: (lastSet?.set_number ?? 0) + 1,
      weight: lastSet?.weight_kg ?? null,
    })
  }

  function finish() {
    if (done.length === 0) {
      confirmation.ask({ title: 'Treino sem séries concluídas', description: 'Complete pelo menos uma série ou descarte o treino com o botão X.' })
      return
    }
    if (changed) {
      actions.finish.reset()
      setAskingToUpdate(true)
    } else {
      confirmation.ask({ title: 'Finalizar este treino?', confirmLabel: 'Finalizar', onConfirm: () => complete(false) })
    }
  }

  function complete(updateRoutine: boolean) {
    actions.finish.mutate(updateRoutine, { onSuccess: () => {
      storeRestDurations(id)
      navigate('/workouts/summary/' + id, { replace: true })
    } })
  }

  function selectExercise(exercise: Exercise) {
    if (groups.some((g) => g.exercise.id === exercise.id)) {
      setPickerError('Este exercício já está no treino.')
      return
    }

    const callbacks = {
      onSuccess: () => {
        if (picker && picker !== 'add') {
          setRest(null)
          setOpen((current) => ({ ...current, [groupKey({ ...picker, exercise })]: true }))
        }
        setPicker(null)
      },
      onError: () => setPickerError('Não foi possível salvar o exercício. Tente novamente.'),
    }

    if (picker === 'add') {
      actions.addExercise.mutate({ exerciseId: exercise.id, order: Math.max(plan?.length ?? 0, (groups.at(-1)?.order ?? -1) + 1) }, callbacks)
    } else if (picker) {
      const replace = () => actions.replaceExercise.mutate({
        exerciseId: picker.exercise.id, replacementId: exercise.id, order: picker.order,
      }, callbacks)
      if (picker.sets.some((s) => s.completed)) {
        confirmation.ask({ title: 'Substituir exercício?', description: 'Os registros das séries concluídas deste exercício serão apagados.',
          confirmLabel: 'Substituir', danger: true, onConfirm: replace })
      } else replace()
    }
  }

  function discard() {
    confirmation.ask({
      title: 'Descartar este treino?', description: 'As séries registradas serão perdidas.', confirmLabel: 'Descartar treino', danger: true,
      onConfirm: () => actions.discard.mutate(undefined, { onSuccess: () => {
        storeRestDurations(id)
        navigate('/workouts', { replace: true })
      } }),
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/workouts')} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <h1 className={styles.headerTitle}>Treino ativo</h1>
          <button type="button" className={styles.back} disabled={busy} onClick={discard} aria-label="Descartar treino"><X size={20} /></button>
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={30} />
        </header>

        <section className={styles.sessionHead}>
          <div className={styles.sessionTitle}>
            <i className={styles.liveDot} />
            <div><span className={styles.cap}>ACTIVE SESSION</span><h2>{session.name}</h2></div>
          </div>
          <div className={styles.sessionBtns}>
            <button type="button" className={styles.pauseBtn} disabled={busy || actions.pause.isPending} onClick={() => actions.pause.mutate(session)} aria-label={session.paused_at ? 'Resume' : 'Pause'}>
              {session.paused_at ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button type="button" className={styles.finishBtn} disabled={busy || routine.isFetching} onClick={finish}>Finalizar <Flag size={14} /></button>
          </div>
        </section>

        {(editFailed || (actions.finish.isError && !askingToUpdate)) && <p role="alert" className={styles.empty}>Não foi possível salvar a alteração. Tente novamente.</p>}
        {routine.isError && <p role="alert" className={styles.empty}>Não foi possível carregar a rotina para comparar as alterações. <button type="button" onClick={() => routine.refetch()}>Tentar novamente</button></p>}

        <section className={styles.statsBar}>
          <div><span className={styles.cap}><Clock size={11} /> TEMPO</span><strong>{fmtClock(workoutSeconds(session, now))}</strong></div>
          <div><span className={styles.cap}><Check size={11} /> SÉRIES</span><strong>{done.length}<small>/{sets.length}</small></strong></div>
          <div><span className={styles.cap}><Maximize2 size={11} /> VOLUME</span><strong>{fmtNum(volumeOf(sets))}<small>kg</small></strong></div>
        </section>

        {groups.length === 0 && <p className={styles.empty}>Treino vazio. Adicione seu primeiro exercício abaixo.</p>}

        {groups.map((g) => {
          const key = groupKey(g)
          const isOpen = open[key] ?? g === currentGroup
          const target = planFor(g)?.target_sets
          let workingIndex = 0
          return (
            <section key={key} className={styles.exCard}>
              <div className={styles.exHead}>
                <ActiveExerciseThumbnail exercise={g.exercise} />
                <button type="button" className={styles.exerciseToggle} aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}>
                  <div className={styles.rText}>
                    <div className={styles.tagRow}>
                      <span className={styles.muscleTag}>{muscleLabel(g.exercise.muscle_group).toUpperCase()}</span>
                      {target && <small>Meta: {target} séries</small>}
                    </div>
                    <strong>{g.exercise.name}</strong>
                    {!isOpen && <small className={styles.planned}>{g.sets.length} séries planejadas</small>}
                  </div>
                </button>
                <div className={styles.menuWrap}>
                  <button type="button" className={styles.plainBtn} onClick={() => setMenuEx(menuEx === key ? null : key)} aria-label="Opções do exercício" aria-expanded={menuEx === key} disabled={busy}>
                    {isOpen ? <MoreVertical size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {menuEx === key && (
                    <div className={styles.menu}>
                      <button type="button" disabled={busy} onClick={() => { setMenuEx(null); setPickerError(''); setPicker(g) }}>Substituir exercício</button>
                      <button type="button" disabled={busy} onClick={() => { setMenuEx(null); actions.removeExercise.mutate({ exerciseId: g.exercise.id, order: g.order }) }}>Remover exercício</button>
                    </div>
                  )}
                </div>
              </div>

              {isOpen && (
                <>
                  <RestDurationField seconds={restFor(g)} onApply={(seconds) => changeRest(g, seconds)} />
                  <div className={styles.setHead}><span>SÉRIE</span><span>ANTERIOR</span><span>KG</span><span>REPS</span><span>FEITO</span><span /></div>
                  {g.sets.map((s) => {
                    if (!s.is_warmup) workingIndex++
                    return (
                      <SetRow
                        key={s.id}
                        set={s}
                        label={workingIndex}
                        previous={previous.data?.get(g.exercise.id)?.find((p) => p.set_number === s.set_number)}
                        current={s.id === currentSetId}
                        busy={busy}
                        onRemove={() => { if (!busy) actions.removeSet.mutate(s.id) }}
                        onCommit={(patch) => actions.updateSet.mutate({ setId: s.id, patch })}
                        onToggle={(w, r) => toggleSet(g, s, w, r)}
                        onTypeChange={(type) => actions.updateSet.mutate({
                          setId: s.id, patch: { set_type: type, is_warmup: isPreparation(type) },
                        })}
                      />
                    )
                  })}
                  <button type="button" className={styles.addSet} disabled={busy} onClick={() => addSet(g)}><Plus size={14} /> Adicionar série</button>
                  {g.exercise.photo_path && <CustomExercisePhoto path={g.exercise.photo_path} name={g.exercise.name} />}
                  <ActiveGuidance exercise={g.exercise} onDetails={() => setDetail(g.exercise)} />
                </>
              )}
            </section>
          )
        })}

        <button type="button" className={styles.addExBtn} disabled={busy} onClick={() => { setPickerError(''); setPicker('add') }}><Plus size={14} /> Adicionar exercício</button>
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
            <button type="button" onClick={() => setRest({ ...rest, endsAt: Math.min(rest.endsAt + 30000, Date.now() + MAX_REST_SECONDS * 1000) })}>+30s</button>
            <button type="button" className={styles.skip} onClick={() => setRest(null)}>Pular descanso <FastForward size={14} /></button>
          </div>
        </section>
      )}

      {picker && (
        <ExercisePicker
          title={picker === 'add' ? 'Adicionar exercício' : 'Substituir exercício'}
          excludedIds={exerciseIds}
          error={pickerError}
          saving={editing}
          onClose={() => { if (!editing) setPicker(null) }}
          onPick={selectExercise}
        />
      )}
      {confirmation.dialog}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
      {askingToUpdate && (
        <FinishOptions name={routine.data?.name ?? session.name} busy={actions.finish.isPending} error={actions.finish.isError}
          onClose={() => { actions.finish.reset(); setAskingToUpdate(false) }} onFinish={complete} />
      )}
    </div>
  )
}
