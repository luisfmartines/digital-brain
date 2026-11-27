import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, NavLink, useParams } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfileConnections } from '../../features/social/queries'
import styles from './Profile.module.css'

export default function ProfileConnectionsPage({ direction }: { direction: 'followers' | 'following' }) {
  const { id } = useParams()
  const { user } = useAuth()
  const own = !id || id === user?.id
  const profilePath = own ? '/profile' : '/profiles/' + id
  const connections = useProfileConnections(direction, id)
  const profile = connections.data?.pages[0]?.profile
  const people = connections.data?.pages.flatMap((page) => page.profiles) ?? []
  const heading = profile?.username ? '@' + profile.username : profile?.display_name || (own ? 'Seu perfil' : 'Perfil')
  const title = direction === 'followers' ? 'Seguidores' : 'Seguindo'

  return (
    <main className={styles.connectionsListPage}>
      <header className={styles.connectionsListHeader}>
        <Link to={profilePath} aria-label="Voltar ao perfil"><ArrowLeft size={22} /></Link>
        <h1>{heading}</h1>
      </header>
      <nav className={styles.connectionsTabs} aria-label="Conexões do perfil">
        <NavLink to={profilePath + '/followers'} replace>Seguidores</NavLink>
        <NavLink to={profilePath + '/following'} replace>Seguindo</NavLink>
      </nav>
      {connections.isPending && <p className={styles.connectionsMessage} role="status">Carregando…</p>}
      {connections.isError && (
        <p className={styles.connectionsMessage} role="alert">Não foi possível carregar a lista.{' '}
          <button type="button" className={styles.backLink}
            onClick={() => void (connections.isFetchNextPageError ? connections.fetchNextPage() : connections.refetch())}>
            Tentar novamente
          </button>
        </p>
      )}
      {connections.isSuccess && people.length === 0 && !connections.hasNextPage && (
        <p className={styles.connectionsMessage}>
          {direction === 'followers'
            ? (own ? 'Você ainda não tem seguidores.' : 'Este perfil ainda não tem seguidores.')
            : (own ? 'Você ainda não segue ninguém.' : 'Este perfil ainda não segue ninguém.')}
        </p>
      )}
      {people.length > 0 && (
        <ul className={styles.connectionsPeople} aria-label={title}>
          {people.map((person) => {
            const name = person.display_name || person.username || 'Perfil'
            return (
              <li key={person.id}>
                <Link to={'/profiles/' + person.id}>
                  <Avatar name={name} url={person.avatar_url} size={44} />
                  <span><strong>{name}</strong>{person.username && <small>@{person.username}</small>}</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {connections.hasNextPage && !connections.isError && (
        <button type="button" className={styles.connectionMore} disabled={connections.isFetching}
          onClick={() => void connections.fetchNextPage()}>
          {connections.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </main>
  )
}
