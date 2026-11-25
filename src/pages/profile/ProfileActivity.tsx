import { useState } from 'react'
import { Activity, CalendarCheck, Copy, Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import Dialog from '../../components/ui/Dialog'
import { useCopySharedRoutine, type ProfileActivity, type ProfileRoutine } from '../../features/social/sharedProfile'
import { translateName } from '../../features/exercisedb/translate'
import { restLabel } from '../../features/workouts/setTypes'
import { useFeed } from '../../features/social/queries'
import { parseDate } from '../../lib/date'
import FeedPostCard from '../workouts/FeedPostCard'
import workoutStyles from '../workouts/workouts.module.css'
import styles from './Profile.module.css'

const dateLabel = (value: string) => new Date(value.length === 10 ? value + 'T12:00:00' : value)
  .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
const duration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  return hours ? hours + ' h ' + minutes % 60 + ' min' : minutes + ' min'
}
const setsLabel = (sets: number) => sets === 1 ? '1 série' : sets + ' séries'

export function ProfilePhotos({ photos = [] }: { photos?: ProfileActivity['photos'] }) {
  const [selected, setSelected] = useState<ProfileActivity['photos'][number] | null>(null)
  if (!photos.length) return null

  return (
    <>
      <ul className={styles.photoRail} aria-label="Fotos de treino">
        {photos.map((photo) => (
          <li key={photo.url + photo.at}>
            <button type="button" aria-label={'Ampliar foto de ' + photo.name} onClick={() => setSelected(photo)}>
              <img src={photo.url} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {selected && <Dialog title={selected.name} onClose={() => setSelected(null)}>
        <img className={styles.activityPhoto} src={selected.url} alt={'Foto de ' + selected.name} />
      </Dialog>}
    </>
  )
}

export function ProfileCounts({ activity }: { activity?: ProfileActivity }) {
  if (!activity) return null
  const counts = [
    { label: 'Treinos', value: activity.workoutCount },
    { label: 'Seguidores', value: activity.followers },
    { label: 'Seguindo', value: activity.following },
  ]
  return (
    <dl className={styles.profileCounts}>
      {counts.map(({ label, value }) => (
        <div key={label}><dt>{label}</dt><dd>{value?.toLocaleString('pt-BR') ?? '—'}</dd></div>
      ))}
    </dl>
  )
}

type Selected = { type: 'routine'; item: ProfileRoutine } | { type: 'workout'; item: ProfileActivity['workouts'][number] }

export default function ProfileActivitySections({ routines, activity, own = false }: {
  routines?: ProfileRoutine[]; activity?: ProfileActivity; own?: boolean
}) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const copy = useCopySharedRoutine()
  const [copied, setCopied] = useState<Record<string, string>>({})
  const weekDays = activity?.weekVolume?.filter((day) => day.seconds !== undefined) ?? []
  const totalSeconds = weekDays.reduce((sum, day) => sum + (day.seconds ?? 0), 0)
  const maxSeconds = Math.max(1, ...weekDays.map((day) => day.seconds ?? 0))
  const selectedKey = selected && selected.type + ':' + selected.item.id

  function open(selection: Selected) {
    copy.reset()
    setSelected(selection)
  }

  return (
    <>
      {weekDays.length > 0 && (
        <section className={styles.card} aria-label="Tempo na academia">
          <h2><Activity size={18} /> Tempo na academia</h2>
          <div className={styles.weekTotal}><strong>{duration(totalSeconds)}</strong><small>Nesta semana</small></div>
          <ul className={styles.weekBars} aria-label="Tempo por dia">
            {weekDays.map((day) => {
              const seconds = day.seconds ?? 0
              return (
                <li key={day.date} aria-label={dateLabel(day.date) + ': ' + duration(seconds)}>
                  <span className={styles.weekBarTrack} aria-hidden="true">
                    <i style={{ height: seconds / maxSeconds * 100 + '%' }} />
                  </span>
                  <small aria-hidden="true">{parseDate(day.date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!!routines && <section className={styles.activitySection}>
        <h2><Dumbbell size={18} /> Rotinas</h2>
        {routines.length ? <ul className={styles.routineRail} aria-label="Rotinas de treino">
          {routines.map((routine) => (
            <li key={routine.id}>
              <button type="button" className={styles.profileRoutineCard} aria-haspopup="dialog"
                onClick={() => open({ type: 'routine', item: routine })}>
                <Dumbbell size={19} aria-hidden="true" />
                <strong>{routine.name}</strong>
                {routine.focus && <span>{routine.focus}</span>}
                <small>{routine.exercises.length} {routine.exercises.length === 1 ? 'exercício' : 'exercícios'}</small>
              </button>
            </li>
          ))}
        </ul> : <p className={styles.connectionDetail}>Nenhuma rotina criada.</p>}
      </section>}

      {!own && activity?.workoutCount != null && <section className={styles.activitySection}>
        <h2><CalendarCheck size={18} /> Treinos recentes</h2>
        {activity.workouts.length ? activity.workouts.map((workout) => (
          <article key={workout.id} className={styles.card}>
            <small>{dateLabel(workout.ended_at)}</small>
            <h3>{workout.name}</h3>
            <div className={styles.activityMetrics}><span>{duration(workout.seconds)}</span>
              <span>{Math.round(workout.volume).toLocaleString('pt-BR')} kg</span>
              <span>{workout.exercises.length} {workout.exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
            </div>
            <ol className={styles.sharedExercises}>{workout.exercises.slice(0, 3).map((exercise, index) => (
              <li key={index}><span>{translateName(exercise.name)}</span><small>{setsLabel(exercise.sets)}</small></li>
            ))}</ol>
            <button type="button" className={styles.button} aria-haspopup="dialog" onClick={() => open({ type: 'workout', item: workout })}>
              Ver treino completo
            </button>
          </article>
        )) : <p className={styles.connectionDetail}>Nenhum treino concluído.</p>}
      </section>}

      {!own && activity && <section className={styles.activitySection}>
        <h2>Publicações recentes</h2>
        {activity.posts.length ? activity.posts.map((post) => (
          <article className={styles.card} key={post.id}>
            <small>{dateLabel(post.created_at)}</small>
            {post.caption && <strong>{post.caption}</strong>}
            {post.workout_id && post.workout_name && (
              <Link className={styles.button} to={'/workouts/view/' + post.workout_id}>{post.workout_name}</Link>
            )}
            {post.photo_url && <img className={styles.activityPhoto} src={post.photo_url} alt="Foto publicada" loading="lazy" />}
          </article>
        )) : <p className={styles.connectionDetail}>Nenhuma publicação visível.</p>}
      </section>}

      {selected && selectedKey && <Dialog title={selected.item.name} busy={copy.isPending} onClose={() => setSelected(null)}>
        <ol className={styles.sharedExercises}>{selected.item.exercises.map((exercise, index) => (
          <li key={index}>
            <span>{translateName(exercise.name)}</span>
            <small>{setsLabel(exercise.sets)}
              {'rest' in exercise && exercise.rest > 0 && ' · ' + restLabel(exercise.rest) + ' de descanso'}
            </small>
          </li>
        ))}</ol>
        {!selected.item.exercises.length && <p className={styles.connectionDetail}>Nenhum exercício.</p>}
        {selected.type === 'routine' && own ? (
          <Link className={styles.button} to={'/workouts/routines/' + selected.item.id + '/edit'}>Editar rotina</Link>
        ) : copied[selectedKey] ? (
          <Link className={styles.button} to={'/workouts/routines/' + copied[selectedKey] + '/edit'}>Abrir rotina copiada</Link>
        ) : (
          <button type="button" className={styles.button} disabled={copy.isPending || !selected.item.exercises.length} onClick={() => {
            copy.mutate({ id: selected.item.id, type: selected.type }, {
              onSuccess: (id) => setCopied((current) => ({ ...current, [selectedKey]: id })),
            })
          }}>
            <Copy size={15} /> {copy.isPending ? 'Copiando…' : selected.type === 'workout' ? 'Copiar como rotina' : 'Copiar rotina'}
          </button>
        )}
        {copy.isError && <p role="alert" className={styles.error}>{copy.error.message}</p>}
      </Dialog>}
    </>
  )
}

export function OwnProfileFeed({ userId }: { userId: string }) {
  const feed = useFeed(userId)

  return (
    <section className={styles.activitySection} aria-labelledby="own-profile-activity">
      <h2 id="own-profile-activity">Atividade recente</h2>
      {feed.isPending && <p role="status" className={styles.connectionDetail}>Carregando atividade…</p>}
      {feed.isError && <p role="alert" className={styles.connectionDetail}>
        Não foi possível carregar a atividade. <button type="button" className={styles.button} onClick={() => feed.refetch()}>Tentar novamente</button>
      </p>}
      {feed.data && (feed.data.length ? (
        <ul className={workoutStyles.list}>
          {feed.data.map((post) => <FeedPostCard key={post.id} post={post} userId={userId} />)}
        </ul>
      ) : <p className={styles.connectionDetail}>Nenhuma publicação ainda.</p>)}
    </section>
  )
}
