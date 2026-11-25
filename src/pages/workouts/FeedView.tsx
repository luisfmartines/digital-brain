import { useState } from 'react'
import { Plus, Search, UserCheck, UserPlus, Zap } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/profile/useProfile'
import {
  useFeed, useFollowToggle, useFollowing, useLeaderboard, useSearchProfiles,
} from '../../features/social/queries'
import { useRoutines, useStartWorkout } from '../../features/workouts/queries'
import { startOfWeek } from '../../lib/date'
import { useOnline } from '../../hooks/useOnline'
import { fmtNum } from '../../features/workouts/utils'
import { Link, useNavigate } from 'react-router-dom'
import FeedPostCard from './FeedPostCard'
import styles from './workouts.module.css'

function Finder() {
  const [q, setQ] = useState('')
  const results = useSearchProfiles(q)
  const following = useFollowing().data
  const toggle = useFollowToggle()

  return (
    <section className={styles.finder}>
      <label className={styles.search}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por @usuário" autoFocus /></label>
      {(results.data ?? []).map((p) => {
        const on = following?.has(p.id) ?? false
        return (
          <div key={p.id} className={styles.finderRow}>
            <Link to={`/profiles/${p.id}`} aria-label={`Ver perfil de ${p.display_name ?? p.username ?? 'Atleta'}`}>
              <Avatar url={p.avatar_url} name={p.display_name} size={34} />
            </Link>
            <div className={styles.rText}><Link className={styles.profileLink} to={`/profiles/${p.id}`}><strong>{p.display_name ?? p.username}</strong></Link><small>@{p.username}</small></div>
            <button type="button" className={on ? styles.followOn : styles.follow} onClick={() => toggle.mutate({ id: p.id, following: on })}>
              {on ? <><UserCheck size={13} /> Seguindo</> : <><UserPlus size={13} /> Seguir</>}
            </button>
          </div>
        )
      })}
      {q.trim().length >= 2 && results.data?.length === 0 && <p className={styles.empty}>Nenhum usuário encontrado.</p>}
    </section>
  )
}

export default function FeedView() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const feed = useFeed()
  const following = useFollowing().data
  const board = useLeaderboard(startOfWeek(new Date()))
  const routines = useRoutines().data ?? []
  const start = useStartWorkout()
  const online = useOnline()
  const [finder, setFinder] = useState(false)

  const rivals = [...(board.data ?? [])].sort((a, b) => b.volume_kg - a.volume_kg)
  const me = rivals.find((r) => r.user_id === user?.id)
  const top = rivals[0]
  const gap = me && top && top.user_id !== me.user_id ? top.volume_kg - me.volume_kg + 1 : null
  const ready = routines[0]
  const firstName = profile?.display_name?.split(' ')[0] ?? ''

  const log = () => start.mutate(ready, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })

  return (
    <>
      <div className={styles.feedPills}>
        <span className={styles.pill}><i className={online ? styles.dot : styles.dotOff} /> {online ? 'REDE NEURAL SINCRONIZADA' : 'OFFLINE · SINCRONIZAÇÃO PENDENTE'}</span>
        <button type="button" className={styles.pillBtn} onClick={() => setFinder((v) => !v)}><Zap size={11} /> {following?.size ?? 0} rivais ativos · Buscar</button>
      </div>

      {finder && <Finder />}

      <section className={styles.cta}>
        <Avatar url={profile?.avatar_url} name={profile?.display_name} size={40} />
        <div className={styles.rText}>
          <strong>{ready ? `${ready.name} pronta, ${firstName}?` : `Pronto, ${firstName}?`}</strong>
          <small>
            {gap !== null ? `Faltam ${fmtNum(gap)} kg para assumir o 1º lugar` : me && rivals.length > 1 ? 'Você lidera esta semana' : 'Siga amigos para começar uma competição'}
          </small>
        </div>
        <button type="button" className={styles.smallBtn} onClick={log} disabled={start.isPending}><Plus size={13} /> Registrar série</button>
      </section>

      {feed.data?.length === 0 && <p className={styles.empty}>Nenhuma publicação ainda. Finalize um treino e compartilhe, ou siga amigos para ver os deles.</p>}
      <ul className={styles.list}>
        {(feed.data ?? []).map((p) => <FeedPostCard key={p.id} post={p} userId={user!.id} />)}
      </ul>
    </>
  )
}