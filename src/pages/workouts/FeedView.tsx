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
import { useNavigate } from 'react-router-dom'
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
    const msg = `${post.author?.display_name ?? 'A friend'} finished ${w?.name ?? 'a workout'}${w ? ` (${fmtNum(w.volume)} kg volume)` : ''} on Digital Brain.`
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
        <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={38} />
        <div className={styles.rText}>
          <strong>{post.author?.display_name ?? 'Athlete'}</strong>
          <small>@{post.author?.username ?? 'user'} • {ago(post.created_at)}</small>
        </div>
      </div>
      {w && <div className={styles.postTag}><span><Trophy size={12} /> {w.name}</span><b>{fmtNum(w.volume)} kg volume</b></div>}
      {post.photo_url && <img className={styles.photo} src={post.photo_url} alt="" />}
      {w && (
        <button type="button" className={styles.postSummary} onClick={() => navigate(`/workouts/view/${w.id}`)} aria-label={`View full workout: ${w.name}`}>
          <span className={styles.iconBox}><Zap size={15} /></span>
          <div className={styles.rText}>
            <strong>{w.top ? `${w.top.name} ${w.top.weight}kg` : w.name}</strong>
            <small>{w.minutes} mins duration</small>
          </div>
          <span className={styles.badge}>+{xpFor(w.volume)} XP</span>
          <ChevronRight size={16} className={styles.chev} />
        </button>
      )}
      <div className={styles.postActions}>
        <button type="button" className={post.liked ? styles.likeOn : ''} onClick={() => like.mutate({ postId: post.id, liked: post.liked, userId })} aria-label="Like"><Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}</button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Comments"><MessageCircle size={17} /> {post.comments.length}</button>
        <button type="button" onClick={share} aria-label="Share"><Send size={16} /></button>
      </div>
      {shown.map((c) => (
        <p key={c.id} className={styles.commentLine}><b>{c.author?.display_name?.split(' ')[0] ?? 'User'}:</b> {c.content}</p>
      ))}
      {post.comments.length > 1 && !open && (
        <button type="button" className={styles.viewAll} onClick={() => setOpen(true)}>View all {post.comments.length} comments</button>
      )}
      <form className={styles.commentForm} onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate({ postId: post.id, content: text.trim() }, { onSuccess: () => setText('') }) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" />
        <button type="submit" disabled={!text.trim() || add.isPending}>Post</button>
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
      <label className={styles.search}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by @username" autoFocus /></label>
      {(results.data ?? []).map((p) => {
        const on = following?.has(p.id) ?? false
        return (
          <div key={p.id} className={styles.finderRow}>
            <Avatar url={p.avatar_url} name={p.display_name} size={34} />
            <div className={styles.rText}><strong>{p.display_name}</strong><small>@{p.username}</small></div>
            <button type="button" className={on ? styles.followOn : styles.follow} onClick={() => toggle.mutate({ id: p.id, following: on })}>
              {on ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
            </button>
          </div>
        )
      })}
      {q.trim().length >= 2 && results.data?.length === 0 && <p className={styles.empty}>Nobody found with that username.</p>}
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
        <span className={styles.pill}><i className={online ? styles.dot : styles.dotOff} /> {online ? 'NEURAL MESH SYNCED' : 'OFFLINE · SYNC PENDING'}</span>
        <button type="button" className={styles.pillBtn} onClick={() => setFinder((v) => !v)}><Zap size={11} /> {following?.size ?? 0} Active Rivals · Find</button>
      </div>

      {finder && <Finder />}

      <section className={styles.cta}>
        <Avatar url={profile?.avatar_url} name={profile?.display_name} size={40} />
        <div className={styles.rText}>
          <strong>{ready ? `${ready.name} ready, ${firstName}?` : `Ready, ${firstName}?`}</strong>
          <small>
            {gap !== null ? `Target: ${fmtNum(gap)} kg to secure #1` : me && rivals.length > 1 ? 'You lead this week' : 'Follow friends to start a rivalry'}
          </small>
        </div>
        <button type="button" className={styles.smallBtn} onClick={log} disabled={start.isPending}><Plus size={13} /> Log Set</button>
      </section>

      {feed.data?.length === 0 && <p className={styles.empty}>No posts yet. Finish a workout and share it, or follow friends to see theirs.</p>}
      <ul className={styles.list}>
        {(feed.data ?? []).map((p) => <PostCard key={p.id} post={p} userId={user!.id} />)}
      </ul>
    </>
  )
}