import { useState } from 'react'
import { ChevronRight, Heart, MessageCircle, Send, Trophy, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import { useAddComment, useToggleLike, type FeedPost } from '../../features/social/queries'
import { ago, fmtNum, xpFor } from '../../features/workouts/utils'
import styles from './workouts.module.css'

export default function PostCard({ post, userId }: { post: FeedPost; userId: string }) {
  const navigate = useNavigate()
  const like = useToggleLike()
  const add = useAddComment()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const w = post.workout
  const lastComment = post.comments[post.comments.length - 1]
  const shown = open ? post.comments : lastComment ? [lastComment] : []

  async function share() {
    const msg = post.caption ? (post.author?.display_name ?? 'Um amigo') + ' · ' + post.caption : `${post.author?.display_name ?? 'Um amigo'} concluiu ${w?.name ?? 'um treino'}${w ? ` (${fmtNum(w.volume)} kg de volume)` : ''} no Digital Brain.`
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
      {post.caption && <p className={styles.postCaption}>{post.caption}</p>}
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
