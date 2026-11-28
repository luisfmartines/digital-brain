import { useDeferredValue, useState } from 'react'
import { ChevronRight, Search, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { memberCount, useCommunityDirectory, useMyCommunities } from '../../features/social/communities'
import { ACTIVITIES, type ActivityCategory } from '../../features/workouts/activities'
import styles from './Social.module.css'

type Cards = NonNullable<ReturnType<typeof useCommunityDirectory>['data']>
const formatNumber = new Intl.NumberFormat('pt-BR')

function CommunityList({ items }: { items: Cards }) {
  return (
    <ul className={styles.communityGrid}>
      {items.map((community) => (
        <li key={community.id}>
          <Link className={styles.communityCard} to={'/feed/communities/' + community.id}>
            <span className={styles.coverSmall}>
              {community.photo_url ? <img src={community.photo_url} alt="" loading="lazy" /> : <UsersRound size={21} />}
            </span>
            <div><strong>{community.name}</strong><small>{community.category} · {formatNumber.format(memberCount(community))} {memberCount(community) === 1 ? 'membro' : 'membros'}</small></div>
            <ChevronRight className={styles.chevron} size={16} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function CommunitiesView() {
  const [category, setCategory] = useState<ActivityCategory | ''>('')
  const [search, setSearch] = useState('')
  const term = useDeferredValue(search.trim())
  const directory = useCommunityDirectory(category, term)
  const mine = useMyCommunities()
  const other = directory.data

  return (
    <div className={styles.stack}>
      <section className={styles.section} aria-labelledby="my-communities">
        <h1 id="my-communities">Minhas comunidades</h1>
        {mine.isError ? <p className={styles.error} role="alert">Não foi possível carregar suas comunidades. <button type="button" onClick={() => mine.refetch()}>Tentar novamente</button></p>
          : mine.isPending ? <p role="status" className={styles.empty}>Carregando suas comunidades…</p>
          : mine.data?.length ? <CommunityList items={mine.data} />
          : <p className={styles.empty}>Os grupos que você criar ou dos quais participar aparecem aqui.</p>}
      </section>
      <section className={styles.section}>
        <h2>Comunidades mais populares</h2>
        <div className={styles.filters}>
          <label className={styles.search}><Search size={17} /><input type="search" aria-label="Buscar comunidades" placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <select value={category} aria-label="Filtrar por modalidade" onChange={(e) => setCategory(e.target.value as ActivityCategory | '')}>
            <option value="">Todas as modalidades</option>
            {ACTIVITIES.map((activity) => <option key={activity}>{activity}</option>)}
          </select>
        </div>
        {directory.isPending ? <p role="status" className={styles.empty}>Carregando comunidades…</p>
          : directory.isError ? <p role="alert" className={styles.error}>Não foi possível carregar as comunidades. <button type="button" onClick={() => directory.refetch()}>Tentar novamente</button></p>
          : other?.length ? <CommunityList items={other} />
          : <p className={styles.empty}>{search || category ? 'Nenhuma comunidade encontrada.' : 'Nenhuma outra comunidade disponível por enquanto.'}</p>}
      </section>
    </div>
  )
}
