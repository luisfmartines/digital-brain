import { Activity, ChevronRight, Heart, MessageCircle, Send, Trophy, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import { useDevice } from '../../expo/device'
import { useToggleLike, type FeedPost } from '../../features/social/queries'
import { ago, fmtNum, xpFor } from '../../features/workouts/utils'
import { formatDistance } from '../../features/workouts/activities'
import styles from './workouts.module.css'

export default function PostCard({ post, userId }: { post: FeedPost; userId: string }) {
  const navigate = useNavigate()
  const device = useDevice()
  const like = useToggleLike()
  const w = post.workout
  const photos = post.photo_urls?.length ? post.photo_urls : post.photo_url ? [post.photo_url] : []
  const lastComment = post.comments[post.comments.length - 1]
  const openComments = () => navigate(`/feed/posts/${post.id}/comments`)

  async function share() {
    const author = post.author?.display_name ?? 'Um amigo'
    const msg = post.caption ? author + ' · ' + post.caption
      : w ? `${author} concluiu ${w.name} no Hebbian.` : `${author} compartilhou uma foto no Hebbian.`
    if (device || navigator.share) {
      try {
        if (device) await device.shareText(msg)
        else await navigator.share({ title: 'Hebbian', text: msg })
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
          {w?.category && <span className={styles.postModality}><Activity size={13} /> {w.category}</span>}
          <small>@{post.author?.username ?? 'usuário'} • {ago(post.created_at)}</small>
        </div>
      </div>
      {post.caption && <p className={styles.postCaption}>{post.caption}</p>}
      {w && !w.category && <div className={styles.postTag}>
        <span><Trophy size={12} /> {w.name}</span>
        <b>{fmtNum(w.volume)} kg de volume</b>
      </div>}
      {photos.length > 0 && <div className={styles.postPhotos}>
        {photos.map((url, index) => <img key={url} className={styles.photo} src={url} alt={`Foto ${index + 1} da publicação`} loading="lazy" />)}
      </div>}
      {w && (!w.category || w.minutes > 0) && (
        <button type="button" className={styles.postSummary} onClick={() => navigate(`/workouts/view/${w.id}`)} aria-label={`Ver treino completo: ${w.name}`}>
          <span className={styles.iconBox}><Zap size={15} /></span>
          <div className={styles.rText}>
            <strong>{w.top ? `${w.top.name} ${w.top.weight}kg` : w.name}</strong>
            <small>{w.minutes} min de duração{w.distance != null ? ' · ' + formatDistance(w.distance) : ''}</small>
          </div>
          {!w.category && <span className={styles.badge}>+{xpFor(w.volume)} XP</span>}
          <ChevronRight size={16} className={styles.chev} />
        </button>
      )}
      <div className={styles.postActions}>
        <button type="button" className={post.liked ? styles.likeOn : ''} onClick={() => like.mutate({ postId: post.id, liked: post.liked, userId })} aria-label="Curtir"><Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}</button>
        <button type="button" onClick={openComments} aria-label="Comentários"><MessageCircle size={17} /> {post.comments.length}</button>
        <button type="button" onClick={share} aria-label="Compartilhar"><Send size={16} /></button>
      </div>
      {lastComment && <p className={styles.commentLine}><b>{lastComment.author?.display_name?.split(' ')[0] ?? 'Usuário'}:</b> {lastComment.content}</p>}
      {post.comments.length > 1 && (
        <button type="button" className={styles.viewAll} onClick={openComments}>Ver todos os {post.comments.length} comentários</button>
      )}
    </li>
  )
}
