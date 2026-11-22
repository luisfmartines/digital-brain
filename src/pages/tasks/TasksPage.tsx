import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlignLeft, Bell, Calendar, Check, CheckCircle2, ChevronDown, Clock, MoreVertical, Plus, Zap } from 'lucide-react'
import { useDeleteTask, useTasks, useToggleTask, type Task } from '../../features/tasks/queries'
import styles from './Tasks.module.css'

type Filter = 'all' | 'high' | 'work' | 'personal' | 'fitness' | 'mindset'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: '● High Priority' },
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'mindset', label: 'Mindset' },
]
const CATEGORY_LABEL: Record<string, string> = { work: 'Work', personal: 'Personal', fitness: 'Fitness', mindset: 'Mindset' }

const matches = (t: Task, f: Filter) => f === 'all' || (f === 'high' ? t.priority === 'high' : t.category === f)

function timeLabel(iso: string | null) {
  if (!iso) return 'No time'
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return time
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

function detail(t: Task) {
  const parts: string[] = []
  if (t.remind_minutes_before && t.due_at) {
    const r = new Date(new Date(t.due_at).getTime() - t.remind_minutes_before * 60000)
    parts.push(`Reminder alarm set at ${r.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
  }
  const note = t.notes?.split('\n')[0]
  if (note) parts.push(note)
  return parts.join(' · ')
}

interface CardProps {
  task: Task
  done?: boolean
  menuOpen: boolean
  onMenu: () => void
  onToggle: () => void
  onDelete: () => void
}

function TaskCard({ task, done, menuOpen, onMenu, onToggle, onDelete }: CardProps) {
  const text = detail(task)
  return (
    <li className={`${styles.card} ${done ? styles.cardDone : ''}`}>
      <button type="button" className={`${styles.box} ${done ? styles.boxOn : ''}`} onClick={onToggle} aria-label={done ? 'Mark as pending' : 'Mark as done'}>
        {done && <Check size={14} />}
      </button>
      <div className={styles.body}>
        <div className={styles.metaRow}>
          <span className={styles.time}><Clock size={11} /> {timeLabel(task.due_at)}</span>
          {!done && task.priority === 'high' && <span className={styles.high}>● High Priority</span>}
          {task.category && (
            <span className={task.category === 'fitness' ? styles.chipFit : styles.chip}>{CATEGORY_LABEL[task.category]}</span>
          )}
          {done && <span className={styles.doneTag}>✓ Done</span>}
        </div>
        <strong className={styles.title}>{task.title}</strong>
        {!done && text && (
          <span className={styles.detail}>
            {task.remind_minutes_before ? <Bell size={12} /> : <AlignLeft size={12} />} {text}
          </span>
        )}
      </div>
      <div className={styles.menuWrap}>
        <button type="button" className={styles.kebab} onClick={onMenu} aria-label="Task options"><MoreVertical size={16} /></button>
        {menuOpen && (
          <div className={styles.menu}>
            <Link to={`/tasks/${task.id}/edit`}>Edit</Link>
            <button type="button" onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function TasksPage() {
  const { data } = useTasks()
  const toggle = useToggleTask()
  const remove = useDeleteTask()
  const [filter, setFilter] = useState<Filter>('all')
  const [showDone, setShowDone] = useState(true)
  const [menuId, setMenuId] = useState<string | null>(null)

  const pending = data?.pending ?? []
  const done = data?.done ?? []
  const all = [...pending, ...done]
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0
  const shownPending = pending.filter((t) => matches(t, filter))
  const shownDone = done.filter((t) => matches(t, filter))
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  const message = all.length === 0 ? 'Add a task to get started' : pct >= 67 ? 'High mental clarity · Momentum rolling' : 'Warming up · Keep the loop going'

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <span className={styles.today}><Calendar size={13} /> TODAY, {dateLabel}</span>
        <span className={styles.countPill}><b>●</b> {pending.length} pending · {done.length} completed</span>
      </div>
      <div className={styles.titleRow}>
        <h1 className={styles.h1}>Tasks &amp; Checklist</h1>
        <Link to="/tasks/new" className={styles.newBtn}><Plus size={14} /> New</Link>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroKicker}><CheckCircle2 size={11} /> COGNITIVE THROUGHPUT</span>
          <span className={styles.heroPct}>{pct}%<small>{done.length} of {all.length} completed</small></span>
          <span className={styles.heroMsg}>{message}</span>
          <span className={styles.track}><i style={{ width: `${pct}%` }} /></span>
        </div>
        <div className={styles.ringBox}>
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="21" className={styles.ringBg} />
            <circle cx="26" cy="26" r="21" className={styles.ringFg} strokeDasharray={`${(pct / 100) * 131.95} 131.95`} transform="rotate(-90 26 26)" />
          </svg>
          <span className={styles.ringIcon}><Zap size={18} /></span>
        </div>
      </section>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? styles.filterOn : styles.filter} onClick={() => setFilter(f.id)}>
            {f.label} ({all.filter((t) => matches(t, f.id)).length})
          </button>
        ))}
      </div>

      {shownPending.length === 0 && shownDone.length === 0 && (
        <p className={styles.empty}>{all.length === 0 ? 'No tasks yet. Tap “New” to capture your first one.' : 'No tasks in this filter.'}</p>
      )}

      <ul className={styles.list}>
        {shownPending.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            menuOpen={menuId === t.id}
            onMenu={() => setMenuId(menuId === t.id ? null : t.id)}
            onToggle={() => toggle.mutate({ id: t.id, done: false })}
            onDelete={() => { setMenuId(null); remove.mutate(t.id) }}
          />
        ))}
      </ul>

      {shownDone.length > 0 && (
        <>
          <button type="button" className={styles.doneHead} onClick={() => setShowDone((v) => !v)}>
            <span><CheckCircle2 size={15} /> Completed <i className={styles.count}>{shownDone.length}</i></span>
            <ChevronDown size={16} className={showDone ? '' : styles.rotated} />
          </button>
          {showDone && (
            <ul className={styles.list}>
              {shownDone.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  done
                  menuOpen={menuId === t.id}
                  onMenu={() => setMenuId(menuId === t.id ? null : t.id)}
                  onToggle={() => toggle.mutate({ id: t.id, done: true })}
                  onDelete={() => { setMenuId(null); remove.mutate(t.id) }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}