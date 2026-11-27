import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import { useProfile } from '../../features/profile/useProfile'
import { useProfileConnections } from '../../features/social/queries'
import styles from './Profile.module.css'

export default function ProfileConnectionsPage({ direction }: { direction: 'followers' | 'following' }) {
  const profile = useProfile()
  const connections = useProfileConnections(direction)
  const people = connections.data?.pages.flatMap((page) => page.profiles) ?? []
  const title = direction === 'followers' ? 'Seguidores' : 'Seguindo'

  return (
    <main className={styles.connectionsListPage}>
      <header className={styles.connectionsListHeader}>
        <Link to="/profile" aria-label="Voltar ao perfil"><ArrowLeft size={22} /></Link>
        <h1>{profile.data?.username ? '@' + profile.data.username : 'Seu perfil'}</h1>
      </header>
      <nav className={styles.connectionsTabs} aria-label="Conexões do perfil">
        <NavLink to="/profile/followers" replace>Seguidores</NavLink>
        <NavLink to="/profile/following" replace>Seguindo</NavLink>
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
      {connections.isSuccess && people.length === 0 && (
        <p className={styles.connectionsMessage}>{direction === 'followers' ? 'Você ainda não tem seguidores.' : 'Você ainda não segue ninguém.'}</p>
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
