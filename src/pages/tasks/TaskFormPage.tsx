import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlignLeft, Bell, CheckCheck, CheckCircle2, ChevronLeft, Clock, Flag, Flower2, Home, Laptop,
  Lightbulb, Moon, MoreVertical, PersonStanding, Sun, Sunrise, Tag,
} from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import Toggle from '../../components/ui/Toggle'
import { useProfile } from '../../features/profile/useProfile'
import { useDeleteTask, useSaveTask, useTask, type Task, type TaskCategory, type TaskPriority } from '../../features/tasks/queries'
import { addDays, localDateStr, parseDate, startOfDay } from '../../lib/date'
import styles from './TaskForm.module.css'

const QUICK = [
  { label: 'Morning (09:00)', time: '09:00', icon: Sunrise },
  { label: 'Afternoon (14:00)', time: '14:00', icon: Sun },
  { label: 'Evening (19:00)', time: '19:00', icon: Moon },
]
const CATS: { id: TaskCategory; label: string; icon: typeof Laptop }[] = [
  { id: 'work', label: 'Work', icon: Laptop },
  { id: 'personal', label: 'Personal', icon: Home },
  { id: 'fitness', label: 'Fitness', icon: PersonStanding },
  { id: 'mindset', label: 'Mindset', icon: Flower2 },
]
const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

function dateLabel(ds: string) {
  const t = startOfDay()
  if (ds === localDateStr(t)) return 'Today'
  if (ds === localDateStr(addDays(t, 1))) return 'Tomorrow'
  return parseDate(ds).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function TaskForm({ task }: { task?: Task }) {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const save = useSaveTask()
  const remove = useDeleteTask()
  const due = task?.due_at ? new Date(task.due_at) : null

  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(due ? localDateStr(due) : localDateStr())
  const [time, setTime] = useState(
    due ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '09:30'
  )
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'work')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [alarm, setAlarm] = useState(task ? task.remind_minutes_before !== null : true)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    save.mutate(
      {
        id: task?.id,
        input: {
          title: title.trim(),
          notes: notes.trim() || null,
          due_at: new Date(`${date}T${time}:00`).toISOString(),
          category,
          priority,
          remind_minutes_before: alarm ? 10 : null,
        },
      },
      { onSuccess: () => navigate('/routine?tab=tasks', { replace: true }), onError: (e) => setError(e.message) }
    )
  }

  function destroy() {
    if (!task || !window.confirm('Delete this task?')) return
    remove.mutate(task.id, { onSuccess: () => navigate('/routine?tab=tasks', { replace: true }) })
  }

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft size={22} /></button>
          <h1 className={styles.headerTitle}>{task ? 'Edit Task' : 'New Task'}</h1>
          {task && (
            <div className={styles.menuWrap}>
              <button type="button" className={styles.kebab} onClick={() => setMenu((v) => !v)} aria-label="Options"><MoreVertical size={18} /></button>
              {menu && <div className={styles.menu}><button type="button" onClick={destroy}>Delete task</button></div>}
            </div>
          )}
          <Avatar url={profile?.avatar_url} name={profile?.display_name} size={32} />
        </header>

        <section className={styles.workspace}>
          <div className={styles.rowBetween}>
            <span className={styles.kicker}><i /> ACTIVE WORKSPACE</span>
            <span className={styles.hint}>Digital Brain OS</span>
          </div>
          <p>Capture your objective into the second brain with natural scheduling and cognitive tags.</p>
        </section>

        <label className={styles.field}>
          <span className={styles.label}><CheckCircle2 size={14} /> Task name <b>*</b></span>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Review Q4 Architecture PRDs" autoFocus={!task} />
        </label>

        <div className={styles.field}>
          <div className={styles.rowBetween}>
            <span className={styles.label}><Clock size={14} /> Due / Scheduled time</span>
            <label className={styles.dateBtn}>
              {dateLabel(date)}
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          </div>
          <input className={`${styles.input} ${styles.time}`} type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          <div className={styles.chips}>
            {QUICK.map(({ label, time: t, icon: Icon }) => (
              <button key={t} type="button" className={time === t ? styles.chipOn : styles.chip} onClick={() => setTime(t)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.rowBetween}>
            <span className={styles.label}><Tag size={14} /> Domain category</span>
            <span className={styles.hint}>1 Selected</span>
          </div>
          <div className={styles.grid2}>
            {CATS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={category === id ? styles.catOn : styles.cat} onClick={() => setCategory(id)}>
                <Icon size={15} /> <span>{label}</span>
                {category === id && <CheckCircle2 size={14} />}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.rowBetween}>
            <span className={styles.label}><Flag size={14} /> Cognitive priority</span>
            <span className={styles.hint}>Default intensity</span>
          </div>
          <div className={styles.segmented}>
            {PRIORITIES.map((p) => (
              <button key={p.id} type="button" className={priority === p.id ? styles.segOn : styles.seg} onClick={() => setPriority(p.id)}>
                <i className={styles[`dot_${p.id}`]} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <div className={styles.rowBetween}>
            <span className={styles.label}><AlignLeft size={14} /> Optional note</span>
            <span className={styles.hint}>Markdown ready</span>
          </div>
          <textarea className={styles.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add context, link or checklist items..." />
        </label>

        <section className={styles.alarm}>
          <span className={styles.iconBox}><Bell size={16} /></span>
          <div className={styles.alarmText}><strong>Bio-sync alarm</strong><small>Gentle chime 10m before</small></div>
          <Toggle checked={alarm} onChange={setAlarm} label="Bio-sync alarm" />
        </section>

        <section className={styles.focus}>
          <span className={styles.iconBox}><Lightbulb size={16} /></span>
          <div>
            <span className={styles.kicker}>FOCUS RECOMMENDATION</span>
            <p>Early slots tend to protect your most important work. Try scheduling priority tasks in the morning.</p>
          </div>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        <button type="button" className={styles.primary} onClick={submit} disabled={!title.trim() || save.isPending}>
          <CheckCheck size={16} /> {save.isPending ? 'Saving…' : 'Save task'}
        </button>
        <button type="button" className={styles.cancel} onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </div>
  )
}

export default function TaskFormPage() {
  const { id } = useParams()
  const { data: task, isLoading } = useTask(id)
  if (id && isLoading) return <p style={{ padding: 24 }}>Loading…</p>
  return <TaskForm key={task?.id ?? 'new'} task={task ?? undefined} />
}