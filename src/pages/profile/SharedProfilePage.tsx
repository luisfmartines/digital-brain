import { ArrowLeft } from 'lucide-react'
import { Navigate, useParams } from 'react-router-dom'
import ProfileAvatar from './ProfileAvatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfileActivity, useSharedProfile } from '../../features/social/sharedProfile'
import ProfileActivitySections, { ProfileCounts, ProfilePhotos } from './ProfileActivity'
import { useBackNavigation } from '../../hooks/useBackNavigation'
import styles from './Profile.module.css'

export default function SharedProfilePage() {
  const { id } = useParams()
  const back = useBackNavigation('/friends/add')
  const { user } = useAuth()
  const own = user?.id === id
  const profile = useSharedProfile(own ? undefined : id)
  const activity = useProfileActivity(own ? undefined : id)

  if (own) return <Navigate to="/profile" replace />
  if (profile.isPending) return <p role="status">Carregando perfil…</p>
  if (profile.isError) return <><button type="button" className={styles.backLink} onClick={back}><ArrowLeft size={16} /> Voltar</button><p role="alert">{profile.error.message}</p></>

  const { name, username, avatar, bio, level, sharing, completion, routines } = profile.data
  return (
    <div className={styles.page}>
      <button type="button" className={styles.backLink} onClick={back}><ArrowLeft size={16} /> Voltar</button>
      <ProfilePhotos photos={activity.data?.photos} />
      <section className={`${styles.card} ${styles.identity}`}>
        <div className={styles.person}>
          <ProfileAvatar url={avatar} name={name ?? username} size={64} />
          <div>
            <h1>{name || username || 'Perfil'}</h1>
            {username && <small>@{username} · </small>}<small>Nível {level ?? 1}</small>
          </div>
        </div>
        <ProfileCounts activity={activity.data} />
        {bio && <p className={styles.bio}>{bio}</p>}
      </section>
      {sharing && <section className={styles.card}>
        <h2>Conclusão de hábitos</h2>
        <strong className={styles.completion}>{completion === null ? 'Sem dados no período' : completion + '%'}</strong>
        <small>Nos últimos 30 dias completos</small>
      </section>}
      {activity.isError && <p role="alert" className={styles.connectionDetail}>Não foi possível carregar a atividade. <button type="button" onClick={() => activity.refetch()}>Tentar novamente</button></p>}
      <ProfileActivitySections routines={sharing ? routines : undefined} activity={activity.data} />
    </div>
  )
}
