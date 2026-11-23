import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, ArrowUp, Banknote, Check, CheckCircle2, ChevronRight, Clock, Droplet, Flame, Lightbulb, Maximize2, Play, Sparkles, Trophy, TrendingUp, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useProfile } from '../../features/profile/useProfile'
import {
  useMonthFinance, useTasksSummary, useTodayHabits, useToggleHabit, useWorkoutsToday,
} from '../../features/home/queries'
import { WATER_STEP, litersLabel, useAddWater, useWater } from '../../features/water/queries'
import { levelInfo } from '../../features/profile/level'
import FeedView from '../workouts/FeedView'
import { useLastPerformed, useRoutines, useStartWorkout } from '../../features/workouts/queries'
import { estimateMinutes, muscleLabel } from '../../features/workouts/utils'
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

interface HeroRow { key: string; icon: LucideIcon; label: string; text: string; ratio: number; counts: boolean; action?: ReactNode; to?: string }

function Overview() {
  const { data: profile } = useProfile()
  const tasks = useTasksSummary()
  const habits = useTodayHabits()
  const toggle = useToggleHabit()
  const finance = useMonthFinance()
  const water = useWater()
  const addWater = useAddWater()
  const workoutsToday = useWorkoutsToday().data ?? 0
  const routines = useRoutines().data ?? []
  const last = useLastPerformed().data ?? {}
  const startWorkout = useStartWorkout()
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
  const onTrack = !fin || (margin >= 0 && (fin.income === 0 || fin.spent / fin.income <= elapsed + 0.05))
  const burn = Math.max(0, margin) / remainingDays

  const habitList = habits.data?.habits ?? []
  const doneCount = habitList.filter((h) => h.done).length
  const streak = habits.data?.streak ?? 0

  const ml = water.data?.ml ?? 0
  const goal = water.data?.goal ?? 2500
  const tasksTotal = (tasks.data?.doneToday ?? 0) + (tasks.data?.dueNow ?? 0)

  const rows: HeroRow[] = []
  if (has('habits')) rows.push({ key: 'habits', icon: Flame, label: 'Habits', text: `${doneCount}/${habitList.length} habits`, ratio: habitList.length ? doneCount / habitList.length : 0, counts: habitList.length > 0 })
  if (has('tasks')) rows.push({ key: 'tasks', icon: CheckCircle2, label: 'Tasks', text: `${tasks.data?.doneToday ?? 0}/${tasksTotal} tasks`, ratio: tasksTotal ? (tasks.data?.doneToday ?? 0) / tasksTotal : 0, counts: tasksTotal > 0 })
  rows.push({
    key: 'water', icon: Droplet, label: 'Water', text: `${litersLabel(ml)} / ${litersLabel(goal)}`, ratio: goal ? ml / goal : 0, counts: true,
    to: '/routine?tab=habits&edit=water', // toca no nome para ajustar a meta (de 500 em 500 ml)
    action: <button type="button" className={styles.heroPlus} onClick={() => addWater.mutate(WATER_STEP)} disabled={addWater.isPending} aria-label={`Add ${WATER_STEP} ml of water`}>+{WATER_STEP}</button>,
  })
  if (has('workouts')) rows.push({ key: 'workout', icon: Maximize2, label: 'Workout', text: `${Math.min(workoutsToday, 1)}/1 workout`, ratio: Math.min(workoutsToday, 1), counts: true })
  const lv = levelInfo(profile?.xp, profile?.level)
  const counted = rows.filter((r) => r.counts)
  const overall = counted.length ? Math.round((counted.reduce((a, r) => a + Math.min(1, r.ratio), 0) / counted.length) * 100) : 0

  // Rotina "pronta hoje": a que você treinou há mais tempo
  const ready = [...routines].sort((a, b) => (last[a.id] ?? '').localeCompare(last[b.id] ?? ''))[0]
  const readyMuscles = ready ? [...new Set(ready.routine_exercises.map((x) => muscleLabel(x.exercise.muscle_group)))].slice(0, 2).join(' & ') : ''

  function goAssistant(text: string) {
    navigate('/assistant', { state: { prompt: text } })
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (prompt.trim()) goAssistant(prompt.trim())
  }
  function startReady() {
    if (!ready) return navigate('/workouts/routines/new')
    startWorkout.mutate(ready, { onSuccess: (id) => navigate(`/workouts/active/${id}`) })
  }

  return (
    <>
      <div className={styles.topRow}>
        <span className={styles.pill}>
          <i className={online ? styles.dot : styles.dotOff} />
          {online ? 'NEURAL SYNC OPTIMAL · 100%' : 'OFFLINE · SYNC PENDING'}
        </span>
        <span className={styles.date}>{dateLabel}</span>
      </div>

      <h1 className={styles.hello}>Hello, <span>{firstName}</span></h1>
      <p className={styles.sub}>Your mind is clear. {today} {today === 1 ? 'priority' : 'priorities'} scheduled today.</p>

      <section className={styles.hero}>
        <ul className={styles.heroRows}>
          {rows.map((r) => (
            <li key={r.key}>
              <div className={styles.heroLine}>
                {r.to ? (
                  <Link to={r.to} className={styles.heroLink}><r.icon size={13} /> {r.label} <ChevronRight size={11} /></Link>
                ) : (
                  <span><r.icon size={13} /> {r.label}</span>
                )}
                <b>{r.text}</b>
                {r.action}
              </div>
              <span className={styles.heroBar}><i style={{ width: `${Math.min(100, r.ratio * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
        <div className={styles.heroPct}>
          <strong>{overall}%</strong>
          <small>completed today</small>
        </div>
      </section>

      <section className={styles.level} aria-label="Level">
        <span className={styles.levelBadge}><Trophy size={14} /><b>LVL {lv.level}</b></span>
        <div className={styles.levelBody}>
          <div className={styles.levelTop}>
            <strong>{lv.rank}</strong>
            <span>{lv.xp.toLocaleString('en-US')} XP</span>
          </div>
          <span className={styles.levelBar}><i style={{ width: `${lv.pct}%` }} /></span>
          <small>{lv.toNext.toLocaleString('en-US')} XP to Level {lv.level + 1}</small>
        </div>
      </section>

      {has('assistant') && (
        <>
          <form className={styles.command} onSubmit={submit}>
            <Sparkles size={18} className={styles.cmdIcon} />
            <input className={styles.cmdInput} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask Digital Brain or log expense/task..." />
            <button type="submit" className={styles.send} aria-label="Send"><ArrowUp size={18} /></button>
          </form>
          <div className={styles.chips}>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Meeting with Product at 3 PM')}><CheckCircle2 size={14} /> Meeting with Product at 3 PM</button>
            <button type="button" className={styles.chip} onClick={() => goAssistant('Spent R$ 50 at McDonald’s')}><Banknote size={14} /> Spent R$ 50 at McDonald’s</button>
            <button type="button" className={styles.chip} onClick={() => addWater.mutate(500)}><Droplet size={14} /> Log 500ml water</button>
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
          <Link to="/routine?tab=tasks" className={styles.strip}>
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
            <Link to="/routine?tab=habits" className={styles.strip}>
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
              <strong>{ready?.name ?? 'No routine yet'}</strong>
            </div>
            <button type="button" className={styles.start} onClick={startReady} disabled={startWorkout.isPending}><Play size={11} /> {ready ? 'Start' : 'Create'}</button>
          </div>
          <div className={styles.footRow}>
            <span>{ready ? (ready.focus ?? (readyMuscles || 'Ready when you are')) : 'Create your first routine'}</span>
            {ready && <span className={styles.accent}>{ready.routine_exercises.length} exercises • {estimateMinutes(ready.routine_exercises)}m</span>}
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
    </>
  )
}

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'feed' ? 'feed' : 'home'

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {(['home', 'feed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? styles.tabOn : styles.tab}
            onClick={() => setParams(t === 'home' ? {} : { tab: t }, { replace: true })}
          >
            {t === 'home' ? 'Home' : 'Feed'}
          </button>
        ))}
      </div>
      {tab === 'feed' ? <FeedView /> : <Overview />}
    </div>
  )
}