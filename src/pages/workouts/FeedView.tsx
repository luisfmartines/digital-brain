import { useState } from 'react'
import { ChevronRight, Heart, MessageCircle, Plus, Search, Send, Trophy, UserCheck, UserPlus, Zap } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../features/profile/useProfile'
import {
  useAddComment, useFeed, useFollowToggle, useFollowing, useLeaderboard, useSearchProfiles, useToggleLike, type FeedPost,
} from '../../features/social/queries'
import { useRoutines, useStartWorkout } from '../../features/workouts/queries'
import { startOfWeek } from '../../lib/date'
import { useOnline } from '../../hooks/useOnline'
import { ago, fmtNum, xpFor } from '../../features/workouts/utils'
import { Link, useNavigate } from 'react-router-dom'
import styles from './workouts.module.css'

function PostCard({ post, userId }: { post: FeedPost; userId: string }) {
  const navigate = useNavigate()
  const like = useToggleLike()
  const add = useAddComment()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const w = post.workout
  const lastComment = post.comments[post.comments.length - 1]
  const shown = open ? post.comments : lastComment ? [lastComment] : []

  async function share() {
    const msg = `${post.author?.display_name ?? 'Um amigo'} concluiu ${w?.name ?? 'um treino'}${w ? ` (${fmtNum(w.volume)} kg de volume)` : ''} no Digital Brain.`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Digital Brain', text: msg })
      } catch {
        // cancelado
      }
    } else {
      await navigator.clipboard.writeText(msg)
    }
  }

  return (
    <li className={styles.post}>
      <div className={styles.postHead}>
        {post.author ? (
          <Link to={`/profiles/${post.author.id}`} aria-label={`Ver perfil de ${post.author.display_name ?? post.author.username ?? 'Atleta'}`}>
            <Avatar url={post.author.avatar_url} name={post.author.display_name} size={38} />
          </Link>
        ) : <Avatar size={38} />}
        <div className={styles.rText}>
          {post.author ? <Link className={styles.profileLink} to={`/profiles/${post.author.id}`}><strong>{post.author.display_name ?? 'Atleta'}</strong></Link> : <strong>Atleta</strong>}
          <small>@{post.author?.username ?? 'usuário'} • {ago(post.created_at)}</small>
        </div>
      </div>
      {w && <div className={styles.postTag}><span><Trophy size={12} /> {w.name}</span><b>{fmtNum(w.volume)} kg de volume</b></div>}
      {post.photo_url && <img className={styles.photo} src={post.photo_url} alt="" />}
      {w && (
        <button type="button" className={styles.postSummary} onClick={() => navigate(`/workouts/view/${w.id}`)} aria-label={`Ver treino completo: ${w.name}`}>
          <span className={styles.iconBox}><Zap size={15} /></span>
          <div className={styles.rText}>
            <strong>{w.top ? `${w.top.name} ${w.top.weight}kg` : w.name}</strong>
            <small>{w.minutes} min de duração</small>
          </div>
          <span className={styles.badge}>+{xpFor(w.volume)} XP</span>
          <ChevronRight size={16} className={styles.chev} />
        </button>
      )}
      <div className={styles.postActions}>
        <button type="button" className={post.liked ? styles.likeOn : ''} onClick={() => like.mutate({ postId: post.id, liked: post.liked, userId })} aria-label="Curtir"><Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}</button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Comentários"><MessageCircle size={17} /> {post.comments.length}</button>
        <button type="button" onClick={share} aria-label="Compartilhar"><Send size={16} /></button>
      </div>
      {shown.map((c) => (
        <p key={c.id} className={styles.commentLine}><b>{c.author?.display_name?.split(' ')[0] ?? 'Usuário'}:</b> {c.content}</p>
      ))}
      {post.comments.length > 1 && !open && (
        <button type="button" className={styles.viewAll} onClick={() => setOpen(true)}>Ver todos os {post.comments.length} comentários</button>
      )}
      <form className={styles.commentForm} onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate({ postId: post.id, content: text.trim() }, { onSuccess: () => setText('') }) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar comentário…" />
        <button type="submit" disabled={!text.trim() || add.isPending}>Publicar</button>
      </form>
    </li>
  )
}

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
        {(feed.data ?? []).map((p) => <PostCard key={p.id} post={p} userId={user!.id} />)}
      </ul>
    </>
  )
}