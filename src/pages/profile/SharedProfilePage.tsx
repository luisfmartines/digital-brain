import { useState } from 'react'
import { ArrowLeft, Copy, Dumbbell } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ProfileAvatar from './ProfileAvatar'
import { useAuth } from '../../features/auth/useAuth'
import { useCopySharedRoutine, useSharedProfile } from '../../features/social/sharedProfile'
import styles from './Profile.module.css'

export default function SharedProfilePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const own = user?.id === id
  const profile = useSharedProfile(own ? undefined : id)
  const copy = useCopySharedRoutine()
  const [copies, setCopies] = useState<Record<string, string>>({})

  if (own) return <Navigate to="/profile" replace />
  if (profile.isPending) return <p role="status">Carregando perfil…</p>
  if (profile.isError) return <><Link to="/friends/add">Voltar para amigos</Link><p role="alert">{profile.error.message}</p></>

  const { name, username, avatar, bio, level, sharing, completion, routines } = profile.data
  return (
    <div className={styles.page}>
      <Link to="/friends/add" className={styles.backLink}><ArrowLeft size={16} /> Amigos</Link>
      <section className={`${styles.card} ${styles.identity}`}>
        <div className={styles.person}>
          <ProfileAvatar url={avatar} name={name ?? username} size={64} />
          <div>
            <h1>{name || username || 'Perfil'}</h1>
            {username && <small>@{username} · </small>}<small>Nível {level ?? 1}</small>
          </div>
        </div>
        {bio && <p className={styles.bio}>{bio}</p>}
      </section>
      {sharing ? (
        <>
          <section className={styles.card}>
            <h2>Conclusão de hábitos</h2>
            <strong className={styles.completion}>{completion === null ? 'Sem dados no período' : `${completion}%`}</strong>
            <small>Nos últimos 30 dias completos</small>
          </section>
          <h2 className={styles.sharedHeading}><Dumbbell size={19} /> Rotinas de treino</h2>
          {routines.length === 0 && <p className={styles.connectionDetail}>Nenhuma rotina criada.</p>}
          {routines.map((routine) => (
            <section key={routine.id} className={styles.card}>
              <h3>{routine.name}</h3>
              {routine.focus && <small>{routine.focus}</small>}
              <ol className={styles.sharedExercises}>
                {routine.exercises.map((exercise, index) => (
                  <li key={index}><span>{exercise.name}</span><small>{exercise.sets} séries{exercise.reps != null && ` × ${exercise.reps}`}{exercise.rest > 0 && ` · ${exercise.rest}s de descanso`}</small></li>
                ))}
              </ol>
              {copies[routine.id] ? (
                <Link className={styles.button} to={`/workouts/routines/${copies[routine.id]}/edit`}>Abrir rotina copiada</Link>
              ) : <button type="button" className={styles.button} disabled={copy.isPending}
                onClick={() => copy.mutate(routine.id, { onSuccess: (newId) => setCopies((current) => ({ ...current, [routine.id]: newId })) })}>
                <Copy size={15} /> {copy.isPending && copy.variables === routine.id ? 'Copiando…' : 'Copiar rotina'}
              </button>}
              {copy.isError && copy.variables === routine.id && <p role="alert" className={styles.error}>{copy.error.message}</p>}
            </section>
          ))}
        </>
      ) : <p className={styles.connectionDetail}>Esta pessoa ainda não compartilha rotinas ou estatísticas.</p>}
    </div>
  )
}
