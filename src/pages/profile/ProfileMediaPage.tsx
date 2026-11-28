import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Splash from '../../components/layout/Splash'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/profile/useProfile'
import { useProfileMedia } from '../../features/social/profileMedia'
import { useSharedProfile } from '../../features/social/sharedProfile'
import { useBackNavigation } from '../../hooks/useBackNavigation'
import base from '../workouts/workouts.module.css'
import styles from '../workouts/workoutExtras.module.css'

export default function ProfileMediaPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const target = id ?? user?.id
  const own = target === user?.id
  const { data: me } = useProfile()
  const { data: profile } = useSharedProfile(own ? undefined : target)
  const media = useProfileMedia(target)
  const back = useBackNavigation(own ? '/profile' : `/profiles/${target}`)
  const name = own ? me?.display_name ?? me?.username : profile?.name ?? profile?.username
  const photos = media.data?.pages.flatMap((page) => page.photos) ?? []

  if (media.isLoading) return <Splash />
  return (
    <div className={base.screen}>
      <main className={base.frame}>
        <header className={styles.detailHead}>
          <button type="button" className={base.back} onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <h1>{own ? 'Minhas mídias' : name ? `Mídias de ${name}` : 'Mídias do perfil'}</h1>
        </header>
        {media.isError && <p className={base.error} role="alert">Não foi possível carregar as mídias. <button type="button" onClick={() => media.refetch()}>Tentar novamente</button></p>}
        {media.isSuccess && photos.length === 0 && <p className={base.empty}>Nenhuma mídia de treino para exibir.</p>}
        <ul className={styles.gallery} aria-label="Mídias de treino">
          {photos.map((photo) => (
            <li key={photo.workoutId + photo.url}>
              <Link to={`/workouts/view/${photo.workoutId}`} className={styles.mediaCard} aria-label={`Abrir treino ${photo.name}`}>
                <img src={photo.url} alt={`Foto do treino ${photo.name}`} loading="lazy" />
                <span className={styles.mediaCaption}>
                  <span><strong>{photo.name}</strong><small>{new Date(photo.at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</small></span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {media.hasNextPage && <button type="button" className={base.routineAction} disabled={media.isFetchingNextPage}
          onClick={() => media.fetchNextPage()}>{media.isFetchingNextPage ? 'Carregando…' : 'Carregar mais mídias'}</button>}
      </main>
    </div>
  )
}
