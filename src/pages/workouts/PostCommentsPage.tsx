import { useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Heart, Send, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../../components/ui/Avatar'
import Splash from '../../components/layout/Splash'
import { useAuth } from '../../features/auth/useAuth'
import { useAddComment, usePostConversation, useToggleCommentLike, useToggleLike, type FeedComment } from '../../features/social/queries'
import { useBackNavigation } from '../../hooks/useBackNavigation'
import { ago } from '../../features/workouts/utils'
import base from './workouts.module.css'
import styles from './workoutExtras.module.css'

const reactions = [
  ['💪', 'Força'], ['🔥', 'Fogo'], ['👏', 'Palmas'], ['🏋️', 'Treino'], ['🏆', 'Troféu'],
]
const authorName = (comment: FeedComment) => comment.author?.display_name ?? comment.author?.username ?? 'Atleta'

function orderConversation(comments: FeedComment[]) {
  const index = new Map(comments.map((comment) => [comment.id, comment]))
  const groups = new Map<string | null, FeedComment[]>()
  for (const comment of comments) {
    const parent = comment.parent_id && index.has(comment.parent_id) ? comment.parent_id : null
    const group = groups.get(parent) ?? []
    group.push(comment)
    groups.set(parent, group)
  }
  const ordered: FeedComment[] = []
  function append(parent: string | null) {
    for (const comment of groups.get(parent) ?? []) {
      ordered.push(comment)
      append(comment.id)
    }
  }
  append(null)
  return { ordered, index }
}

export default function PostCommentsPage() {
  const { id } = useParams()
  const back = useBackNavigation('/?tab=feed')
  const { user } = useAuth()
  const conversation = usePostConversation(id)
  const postLike = useToggleLike()
  const commentLike = useToggleCommentLike(id)
  const add = useAddComment()
  const [text, setText] = useState('')
  const [reply, setReply] = useState<FeedComment | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const post = conversation.data
  const photos = post?.photo_urls?.length ? post.photo_urls : post?.photo_url ? [post.photo_url] : []

  if (conversation.isLoading) return <Splash />
  const { ordered, index } = orderConversation(post?.comments ?? [])
  const poster = post?.author?.display_name ?? post?.author?.username ?? 'Atleta'

  return (
    <main className={styles.conversation}>
      <div className={styles.conversationFrame}>
        <header className={styles.detailHead}>
          <button className={base.back} type="button" onClick={back} aria-label="Voltar"><ArrowLeft size={20} /></button>
          <h1>Comentários</h1>
        </header>
        {conversation.isError && <p role="alert" className={base.error}>Não foi possível carregar os comentários. <button type="button" onClick={() => conversation.refetch()}>Tentar novamente</button></p>}
        {!conversation.isError && !post && <p className={base.empty}>Esta publicação está indisponível.</p>}
        {post && <>
          <section className={styles.postContext}>
            <div className={styles.contextAuthor}>
              {post.author
                ? <Link to={`/profiles/${post.author.id}`} aria-label={`Ver perfil de ${poster}`}><Avatar url={post.author.avatar_url} name={poster} size={40} /></Link>
                : <Avatar name={poster} size={40} />}
              <div><strong>{poster}</strong>
                {post.workout?.category && <span className={base.postModality}>{post.workout.category}</span>}
                <small>{new Date(post.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</small>
              </div>
            </div>
            {post.workout && (!post.workout.category || post.workout.minutes > 0) &&
              <Link className={styles.contextWorkout} to={`/workouts/view/${post.workout.id}`}>{post.workout.name}<ChevronRight size={16} /></Link>}
            {post.caption && <p>{post.caption}</p>}
            {photos.length > 0 && <div className={base.postPhotos}>
              {photos.map((url, index) => <img key={url} className={base.photo} src={url} alt={`Foto ${index + 1} da publicação`} loading="lazy" />)}
            </div>}
            <div className={styles.contextCounts}>
              <button type="button" aria-pressed={post.liked} aria-label="Curtir publicação" disabled={postLike.isPending || !user}
                onClick={() => user && postLike.mutate({ postId: post.id, liked: post.liked, userId: user.id })}>
                <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes} {post.likes === 1 ? 'curtida' : 'curtidas'}
              </button>
              <small>{ordered.length} {ordered.length === 1 ? 'comentário' : 'comentários'}</small>
            </div>
          </section>

          {ordered.length === 0 && <p className={styles.threadEmpty}>Ainda não há comentários. Comece a conversa.</p>}
          <ul className={styles.thread} aria-label="Comentários da publicação">
            {ordered.map((comment) => {
              const name = authorName(comment)
              const parent = comment.parent_id ? index.get(comment.parent_id) : undefined
              return <li key={comment.id} className={styles.comment} data-reply={!!parent}>
                {comment.author
                  ? <Link to={`/profiles/${comment.author.id}`} aria-label={`Ver perfil de ${name}`}><Avatar name={name} url={comment.author.avatar_url} size={parent ? 30 : 36} /></Link>
                  : <Avatar name={name} size={parent ? 30 : 36} />}
                <div className={styles.commentBody}>
                  <div><strong>{name}</strong><small>{ago(comment.created_at)}</small></div>
                  {parent && <small className={styles.replyTo}>Em resposta a {authorName(parent)}</small>}
                  <p>{comment.content}</p>
                  <button type="button" className={styles.replyAction} disabled={add.isPending} onClick={() => { setReply(comment); input.current?.focus() }}>Responder</button>
                </div>
                <button type="button" className={styles.commentLike} aria-label={`Curtir comentário de ${name}`}
                  aria-pressed={!!comment.liked} disabled={commentLike.isPending}
                  onClick={() => commentLike.mutate({ commentId: comment.id, liked: !!comment.liked })}>
                  <Heart size={17} fill={comment.liked ? 'currentColor' : 'none'} /> {!!comment.likes && <small>{comment.likes}</small>}
                </button>
              </li>
            })}
          </ul>
          {(commentLike.isError || postLike.isError) && <p className={base.error} role="alert">Não foi possível atualizar a curtida. Tente novamente.</p>}

          <form className={styles.composer} onSubmit={(event) => {
            event.preventDefault()
            const content = text.trim()
            if (!content || add.isPending) return
            add.mutate({ postId: post.id, content, parentId: reply?.id }, { onSuccess: () => { setText(''); setReply(null) } })
          }}>
            {reply && <div className={styles.replyDraft}>Respondendo a <strong>{authorName(reply)}</strong>
              <button type="button" aria-label="Cancelar resposta" disabled={add.isPending} onClick={() => setReply(null)}><X size={16} /></button>
            </div>}
            <div className={styles.reactions} aria-label="Reações rápidas">
              {reactions.map(([emoji, label]) => <button key={emoji} type="button" disabled={add.isPending} aria-label={`Inserir reação ${label}`}
                onClick={() => { setText((value) => value.length + emoji.length <= 500 ? value + emoji : value); input.current?.focus() }}>{emoji}</button>)}
            </div>
            <div className={styles.composerField}>
              <textarea ref={input} rows={1} value={text} maxLength={500} disabled={add.isPending} onChange={(event) => setText(event.target.value)}
                aria-label={reply ? 'Sua resposta' : 'Seu comentário'} placeholder={reply ? 'Escreva sua resposta…' : 'Escreva um comentário…'} />
              <button type="submit" aria-label={reply ? 'Enviar resposta' : 'Enviar comentário'} disabled={!text.trim() || add.isPending}><Send size={18} /></button>
            </div>
            {add.isError && <p className={base.error} role="alert">Não foi possível publicar. Tente novamente.</p>}
          </form>
        </>}
      </div>
    </main>
  )
}
