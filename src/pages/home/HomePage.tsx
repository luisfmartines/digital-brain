import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, Banknote, Check, CheckCircle2, Clock, Flame, Lightbulb, Maximize2, Play, Sparkles, TrendingUp, Wallet } from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import { useMonthFinance, useNextRoutine, useTasksSummary, useTodayHabits, useToggleHabit } from '../../features/home/queries'
import { useOnline } from '../../hooks/useOnline'
import { dayOfYear } from '../../lib/date'
import { formatBRL } from '../../features/onboarding/utils'
import styles from './Home.module.css'

const QUOTES = [
  'Cognitive momentum is built on eliminating choice fatigue.',
  'Small actions, repeated daily, become identity.',
  'What gets scheduled gets done.',
  'Consistency beats intensity when intensity is not sustainable.',
  'Protect the streak, not the mood.',
]

function taskLine(t: { due_at: string | null; notes: string | null } | null) {
  if (!t) return 'Add your first task'
  if (!t.due_at) return t.notes ?? 'No time set'
  const d = new Date(t.due_at)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return `Scheduled at ${time}`
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

export default function HomePage() {
  const { data: profile } = useProfile()
  const tasks = useTasksSummary()
  const habits = useTodayHabits()
  const toggle = useToggleHabit()
  const routine = useNextRoutine()
  const finance = useMonthFinance()
  const online = useOnline()
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')

  const modules: string[] = profile?.enabled_modules ?? []
  const has = (m: string) => modules.includes(m)
  const firstName = profile?.display_name?.split(' ')[0] ?? ''
  const today = tasks.data?.today ?? 0

  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const elapsed = now.getDate() / daysInMonth
  const remainingDays = daysInMonth - now.getDate() + 1

  const fin = finance.data
  const margin = fin?.margin ?? 0
  const onTrack = !fin || margin >= 0 && (fin.income === 0 || fin.spent / fin.income <= elapsed + 0.05)
  const burn = Math.max(0, margin) / remainingDays

  const habitList = habits.data?.habits ?? []
  const doneCount = habitList.filter((h) => h.done).length
  const streak = habits.data?.streak ?? 0

  function goAssistant(text: string) {
    navigate('/assistant', { state: { prompt: text } })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (prompt.trim()) goAssistant(prompt.trim())
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <span className={styles.pill}>
          <i className={online ? styles.dot : styles.dotOff} />
          {online ? 'NEURAL SYNC OPTIMAL · 100%' : 'OFFLINE · SYNC PENDING'}
        </span>
        <span className={styles.date}>{dateLabel}</span>
      </div>

      <h1 className={styles.hello}>Hello, <span>{firstName}</span></h1>
      <p className={styles.sub}>
        Your mind is clear. {today} {today === 1 ? 'priority' : 'priorities'} scheduled today.
      </p>

      {has('assistant') && (
        <>
          <form className={styles.command} onSubmit={submit}>
            <Sparkles size={18} className={styles.cmdIcon} />
            <input className={styles.cmdInput} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask Digital Brain or log expense/task" />
            <button type="submit" className={styles.send} aria-label="Send"><ArrowUp size={18} /></button>
          </form>
          <div className={styles.chips}>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Meeting with Product at 3 PM')}>
              <CheckCircle2 size={14} /> Meeting with Product at 3 PM
            </button>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Spent R$ 50 at McDonald’s')}>
              <Banknote size={14} /> Spent R$ 50 at McDonald’s
            </button>
          </div>
        </>
      )}

      <div className={styles.sectionRow}>
        <span className={styles.label}>ACTIVE SYNAPSES</span>
        <span className={styles.live}>Live overview</span>
      </div>

      {has('tasks') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><CheckCircle2 size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>UP NEXT · PRIORITY</span>
              <strong>{tasks.data?.next?.title ?? 'No tasks yet'}</strong>
            </div>
            <span className={styles.badge}>{tasks.data?.pending ?? 0} pending</span>
          </div>
          <Link to="/tasks" className={styles.strip}>
            <Clock size={14} />
            <span className={styles.stripText}>{taskLine(tasks.data?.next ?? null)}</span>
            <ArrowRight size={14} />
          </Link>
        </section>
      )}

      {has('habits') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Flame size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>HABIT LOOP</span>
              <strong>{streak > 0 ? `${streak}d streak active` : 'Start your streak today'}</strong>
            </div>
            <span className={styles.meta}>{doneCount} of {habitList.length} complete</span>
          </div>
          {habitList.length > 0 ? (
            <div className={styles.habitGrid}>
              {habitList.slice(0, 4).map((h) => (
                <button key={h.id} type="button" className={styles.habit} onClick={() => toggle.mutate({ habitId: h.id, done: h.done })}>
                  <span className={`${styles.box} ${h.done ? styles.boxOn : ''}`}>{h.done && <Check size={12} />}</span>
                  <span className={h.done ? styles.struck : ''}>{h.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <Link to="/habits" className={styles.strip}>
              <span className={styles.stripText}>No habits scheduled today</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </section>
      )}

      {has('workouts') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Maximize2 size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>PHYSICAL ENGINE</span>
              <strong>{routine.data?.name ?? 'No routine yet'}</strong>
            </div>
            <Link to="/workouts" className={styles.start}><Play size={11} /> Start</Link>
          </div>
          <div className={styles.footRow}>
            <span>{routine.data?.notes ?? 'Create your first routine'}</span>
            {routine.data && <span className={styles.accent}>{routine.data.exercises} exercises</span>}
          </div>
        </section>
      )}

      {has('finance') && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.iconBox}><Wallet size={18} /></span>
            <div className={styles.titleBox}>
              <span className={styles.cap}>CAPITAL MARGIN</span>
              <strong>{formatBRL(margin)}</strong>
            </div>
            <span className={styles.badge}><TrendingUp size={10} /> {onTrack ? 'On Track' : 'Over Budget'}</span>
          </div>
          <div className={styles.progress}><div style={{ width: `${Math.round(elapsed * 100)}%` }} /></div>
          <div className={styles.footRow}>
            <span>Safe burn rate: {formatBRL(burn)} / day</span>
            <span className={styles.accent}>{Math.round(elapsed * 100)}% month elapsed</span>
          </div>
        </section>
      )}

      <section className={styles.quote}>
        <Lightbulb size={16} />
        <div>
          <p>“{QUOTES[dayOfYear() % QUOTES.length]}”</p>
          <small>Digital Brain Digest · Day {dayOfYear()}</small>
        </div>
      </section>
    </div>
  )
}