import { useState } from 'react'
import { Dumbbell, Plus, Search, UserPlus, UsersRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/useAuth'
import { useFeed } from '../../features/social/queries'
import FeedPostCard from '../workouts/FeedPostCard'
import workoutStyles from '../workouts/workouts.module.css'
import CommunitiesView from './CommunitiesView'
import ChallengesView from './ChallengesView'
import PostComposer from './PostComposer'
import styles from './Social.module.css'

const SECTIONS = [
  ['friends', 'Amigos'], ['explore', 'Explorar'], ['communities', 'Comunidades'], ['challenges', 'Desafios'],
] as const

function Posts({ explore }: { explore: boolean }) {
  const { user } = useAuth()
  const feed = useFeed(undefined, explore ? 'explore' : 'friends')
  if (feed.isPending) return <p className={styles.empty} role="status">Carregando publicações…</p>
  if (feed.isError) return <p className={styles.error} role="alert">Não foi possível carregar as publicações. <button type="button" onClick={() => feed.refetch()}>Tentar novamente</button></p>
  if (!feed.data.length) return <p className={styles.empty}>{explore ? 'Ainda não há publicações em Explorar.' : 'As suas publicações e as de quem você segue aparecem aqui.'}</p>
  return <ul className={workoutStyles.list} aria-label={explore ? 'Publicações em Explorar' : 'Publicações de Amigos'}>
    {user && feed.data.map((post) => <FeedPostCard key={post.id} post={post} userId={user.id} />)}
  </ul>
}

export default function SocialFeed() {
  const [params, setParams] = useSearchParams()
  const [composer, setComposer] = useState(false)
  const [status, setStatus] = useState('')
  const section = SECTIONS.find(([id]) => id === params.get('section'))?.[0] ?? 'friends'
  const showingPosts = section === 'friends' || section === 'explore'

  function openComposer() {
    setStatus('')
    setComposer(true)
  }

  return (
    <div className={`${styles.stack} ${styles.floatSpace}`}>
      <nav className={styles.tabs} aria-label="Seções do feed">
        {SECTIONS.map(([id, label]) => <Link key={id} to={'/?tab=feed&section=' + id} aria-current={section === id ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {showingPosts && <>
        <section className={styles.intro}>
          {section === 'friends' ? <>
            <div><h1>Amigos</h1><p>Acompanhe quem você segue.</p></div>
            <Link className={styles.textLink} to="/friends/add"><UserPlus size={16} /> Buscar amigos</Link>
          </> : <>
            <div><h1>Explorar</h1><p>Descubra publicações compartilhadas por outras pessoas.</p></div>
            <Link className={styles.textLink} to="/friends/add"><Search size={16} /> Buscar pessoas</Link>
          </>}
        </section>
        <div className={styles.floatingActions} role="group" aria-label="Ações do feed">
          <button type="button" className={styles.floatButton} aria-label="Adicionar treino" title="Adicionar treino" onClick={openComposer}><Dumbbell size={24} /></button>
        </div>
        {section === 'explore' && <Link className={styles.textLink} to="/?tab=feed&section=communities"><UsersRound size={16} /> Encontrar comunidades</Link>}
        <Posts explore={section === 'explore'} />
      </>}
      {section === 'communities' && <>
        <CommunitiesView />
        <div className={styles.floatingActions}>
          <Link to="/feed/communities/new" className={styles.floatButton} aria-label="Criar comunidade" title="Criar comunidade" draggable={false}><Plus size={26} /></Link>
        </div>
      </>}
      {section === 'challenges' && <ChallengesView />}
      {status && <p className={styles.notice} role="status">{status}</p>}
      {composer && <PostComposer
        onClose={() => setComposer(false)} onPublished={() => {
          setComposer(false)
          setStatus('Publicação enviada.')
          setParams({ tab: 'feed', section: 'friends' }, { replace: true })
        }} />}
    </div>
  )
}
