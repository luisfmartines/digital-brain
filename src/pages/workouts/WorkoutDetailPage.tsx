import { setTypeOf } from '../../features/workouts/setTypes'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import Splash from '../../components/layout/Splash'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useExerciseMedia } from '../../features/exercisedb/queries'
import { useWorkoutDetail, type WorkoutDetailSet } from '../../features/social/queries'
import { fmtNum, mins, volumeOf, workoutSeconds } from '../../features/workouts/utils'
import { formatDistance } from '../../features/workouts/activities'
import ExerciseImage, { CustomExercisePhoto } from './ExerciseImage'
import FinishedWorkoutPhotos from './FinishedWorkoutPhotos'
import styles from './workouts.module.css'

const kg = (n: number | null) => (n === null ? '—' : `${Number(n.toFixed(2))} kg`)

function CatalogPhoto({ externalId, name }: { externalId: string; name: string }) {
  const media = useExerciseMedia(externalId)
  return media.data?.videoUrl && !media.data.imageUrl
    ? <video src={media.data.videoUrl} autoPlay muted loop playsInline aria-label={`Demonstração de ${name}`} />
    : <ExerciseImage src={media.data?.imageUrl} externalId={externalId} name={name} loading={media.isLoading} />
}

export default function WorkoutDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: w, isLoading, error } = useWorkoutDetail(id)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/?tab=feed', { replace: true }))

  if (isLoading) return <Splash />
  if (error) return <p className={styles.loading}>Não foi possível carregar este treino.</p>
  if (!w) return <Navigate to="/?tab=feed" replace />

  const logged = w.sets.filter((s) => s.completed)
  const groups = new Map<string, { name: string; order: number; sets: WorkoutDetailSet[] }>()
  for (const s of logged) {
    const g = groups.get(s.exercise_id) ?? { name: s.exercise?.name ?? 'Exercício', order: s.exercise_order, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_id, g)
  }
  const exercises = [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ ...g, sets: [...g.sets].sort((a, b) => a.set_number - b.set_number) }))

  const volume = volumeOf(w.sets)
  const secs = workoutSeconds({ ...w, paused_at: null }, 0)
  const date = new Date(w.ended_at ?? w.started_at).toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })
  const photos = w.photo_urls?.length ? w.photo_urls : w.photo_url ? [w.photo_url] : []
  const isOwner = !!w.ended_at && user?.id === w.user_id

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.detHead}>
          <button type="button" className={styles.back} onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
          {w.author ? <Link to={`/profiles/${w.author.id}`} aria-label={`Ver perfil de ${w.author.display_name ?? w.author.username ?? 'Atleta'}`}><Avatar url={w.author.avatar_url} name={w.author.display_name} size={34} /></Link> : <Avatar size={34} />}
          <div className={styles.detWho}>
            <strong>{w.name}</strong>
            <small>{w.author?.display_name ?? 'Atleta'} • {date}</small>
          </div>
          {isOwner && !w.activity_category && <Link to={`/workouts/summary/${w.id}`} className={styles.routineAction}
            aria-label="Ver resumo"><FileText size={16} /></Link>}
        </header>

        <div className={styles.detStats}>
          {(!w.activity_category || secs > 0) && <div className={styles.detStat}><small>Duração</small><strong>{mins(secs)} <i>min</i></strong></div>}
          {w.activity_category ? <>
            <div className={styles.detStat}><small>Modalidade</small><strong>{w.activity_category}</strong></div>
            {w.distance_km != null && <div className={styles.detStat}><small>Distância</small><strong>{formatDistance(w.distance_km)}</strong></div>}
          </> : <>
            <div className={styles.detStat}><small>Volume</small><strong>{fmtNum(volume)} <i>kg</i></strong></div>
            <div className={styles.detStat}><small>Séries</small><strong>{logged.length}</strong></div>
          </>}
        </div>

        {isOwner ? <FinishedWorkoutPhotos workoutId={w.id} photos={photos} /> : photos.length > 0 && <div className={styles.postPhotos}>
          {photos.map((url, index) => <img key={url} className={styles.detPhoto} src={url} alt={`Foto ${index + 1} do treino`} loading="lazy" />)}
        </div>}

        {!w.activity_category && <section className={styles.panel}>
          {exercises.length === 0 && <p className={styles.empty}>Nenhuma série foi registrada neste treino.</p>}
          {exercises.map((ex) => {
            const set = ex.sets[0]
            const path = set.exercise?.photo_path
            const externalId = w.mediaByExercise?.[set.exercise_id]
            return (
            <div key={ex.sets[0].exercise_id} className={styles.detEx}>
              <div className={styles.detExHead}>
                {(path || externalId) && <span className={styles.detailExerciseMedia}>
                  {path ? <CustomExercisePhoto path={path} name={ex.name} thumbnail /> :
                    externalId && <CatalogPhoto externalId={externalId} name={ex.name} />}
                </span>}
                <strong>{ex.name}</strong>
                <small>{ex.sets.length} {ex.sets.length === 1 ? 'série' : 'séries'}</small>
              </div>
              <table className={styles.detTable}>
                <thead><tr><th>SÉRIE</th><th>PESO E REPETIÇÕES</th></tr></thead>
                <tbody>
                  {ex.sets.map((s, i) => {
                    const type = setTypeOf(s)
                    return (
                      <tr key={s.id}>
                        <td>{type.short ? <span className={styles.detWarm} title={type.label}>{type.short}</span> : ex.sets.slice(0, i).filter((x) => !x.is_warmup).length + 1}</td>
                        <td>{s.weight_kg ? `${kg(s.weight_kg)} x ${s.reps ?? '—'}` : `${s.reps ?? '—'} repetições`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )
          })}
        </section>}
      </div>
    </div>
  )
}
