import { useState } from 'react'
import { AlarmClock, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Flame, Minus, Plus, TrendingUp, X, Zap } from 'lucide-react'
import { addDays, isoWeek, localDateStr, startOfDay, startOfWeek } from '../../lib/date'
import {
  byTime, cellState, currentStreak, dayStats, isDone, isScheduled, rangeStats, timeOfDay,
  type CellState, type Habit, type Index,
} from '../../features/habits/stats'
import { useCreateHabit, useToggleLog } from '../../features/habits/queries'
import { HABIT_ICONS } from '../../features/onboarding/habitIcons'
import { DAYS } from '../../features/onboarding/habitPresets'
import { fmtTime } from '../../features/onboarding/utils'
import { ViewSwitch, type View } from './common'
import styles from './habits.module.css'

interface Props {
  habits: Habit[]
  ix: Index
  view: View
  setView: (v: View) => void
  onEdit: (h: Habit) => void
}

const CELL: Record<CellState, string> = {
  done: styles.cellDone,
  missed: styles.cellMissed,
  pending: styles.cellPending,
  planned: styles.cellPlanned,
  off: styles.cellOff,
}
const hourLabel = (h: number) => fmtTime(`${String(h % 24).padStart(2, '0')}:00`)
const slash = (h: Habit) => DAYS.filter((d) => h.weekdays.includes(d.v)).map((d) => d.label).join('/')
const iconOf = (h: Habit) => HABIT_ICONS[h.icon ?? 'custom'] ?? HABIT_ICONS.custom

export default function WeeklyView({ habits, ix, view, setView, onEdit }: Props) {
  const toggle = useToggleLog()
  const create = useCreateHabit()
  const today = startOfDay()
  const todayStr = localDateStr(today)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [quick, setQuick] = useState('')

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = days[6]
  const isCurrent = localDateStr(weekStart) === localDateStr(startOfWeek(today))
  const upTo = weekEnd < today ? weekEnd : today
  const week = rangeStats(habits, ix, weekStart, upTo)
  const prevWeek = rangeStats(habits, ix, addDays(weekStart, -7), addDays(weekStart, -1))
  const delta = prevWeek.scheduled > 0 ? week.pct - prevWeek.pct : null
  const range = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const rows = habits.map((h) => {
    const st = rangeStats([h], ix, weekStart, upTo)
    return { h, done: st.done, sched: st.scheduled, cells: days.map((d) => cellState(h, ix, d, today)) }
  })
  const targets = rows.filter((r) => r.sched > 0)
  const perfect = targets.filter((r) => r.done === r.sched).length
  const flow = week.pct >= 80 ? 'High Flow' : week.pct >= 50 ? 'Steady' : 'Building'
  const bars = days.map((d) => {
    if (d > today) return 0
    const s = dayStats(habits, ix, d)
    return s.scheduled ? s.done / s.scheduled : 0
  })

  const shown = days.filter((d) => d <= today).slice(-4)
  const pendingToday = isCurrent
    ? habits.filter((h) => isScheduled(h, today) && !isDone(ix, h.id, todayStr)).sort(byTime)
    : []
  const next = pendingToday[0]
  const NextIcon = next ? iconOf(next) : null

  const hourStats = new Map<number, { s: number; d: number }>()
  for (const r of rows) {
    if (!r.h.reminder_time) continue
    const hr = Number(r.h.reminder_time.slice(0, 2))
    const cur = hourStats.get(hr) ?? { s: 0, d: 0 }
    hourStats.set(hr, { s: cur.s + r.sched, d: cur.d + r.done })
  }
  let peak: { hr: number; pct: number } | null = null
  for (const [hr, v] of [...hourStats.entries()].sort((a, b) => a[0] - b[0])) {
    if (!v.s) continue
    const pct = Math.round((v.d / v.s) * 100)
    if (!peak || pct > peak.pct) peak = { hr, pct }
  }
  const diff = week.done - prevWeek.done

  function addQuick() {
    create.mutate(
      { name: quick.trim(), weekdays: [0, 1, 2, 3, 4, 5, 6], time: '08:00', category: 'discipline' },
      { onSuccess: () => setQuick('') }
    )
  }

  return (
    <>
      <div className={styles.pillRowSplit}>
        <span className={styles.syncPill}><i /> HABIT MATRIX • SYNAPSES SYNCHRONIZED</span>
        {delta !== null && <span className={styles.delta}><TrendingUp size={11} /> {delta >= 0 ? '+' : ''}{delta}% vs lw</span>}
      </div>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Daily Habits</h1>
          <span className={styles.sub}>Week {isoWeek(weekStart)} • {range}</span>
        </div>
        <div className={styles.bigPct}><strong>{week.pct}%</strong><small>Consistency</small></div>
      </div>

      <ViewSwitch view={view} onChange={setView} />

      <div className={styles.weekNav}>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <strong>{range}</strong>
        <button type="button" disabled={isCurrent} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
        <span className={styles.badge}>W{isoWeek(weekStart)}</span>
        {isCurrent && <span className={styles.badgeSolid}>Current</span>}
      </div>

      <section className={styles.hero}>
        <span className={styles.heroIcon}><Flame size={20} /></span>
        <div className={styles.heroText}>
          <strong>{week.pct}% <em className={styles.badge}>{flow}</em></strong>
          <small>Weekly Success Rate • {perfect}/{targets.length} Target Streaks</small>
        </div>
        <div className={styles.bars}>
          {bars.map((b, i) => <i key={i} className={b > 0 ? styles.barOn : ''} style={{ height: `${Math.max(14, b * 100)}%` }} />)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <span>Consistency Matrix <em className={styles.badge}>{habits.length} active routines</em></span>
          <span className={styles.legendMini}><i className={styles.dotDone} /> Done <i className={styles.dotPlan} /> Plan</span>
        </div>
        <div className={styles.matrix}>
          <div className={`${styles.mRow} ${styles.mHead}`}>
            <span className={styles.cap}>ROUTINE</span>
            {days.map((d) => (
              <span key={localDateStr(d)} className={`${styles.mDay} ${localDateStr(d) === todayStr ? styles.mToday : ''}`}>
                {'SMTWTFS'[d.getDay()]}<b>{d.getDate()}</b>
              </span>
            ))}
          </div>
          {rows.map(({ h, done, sched, cells }) => (
            <div key={h.id} className={styles.mRow}>
              <button type="button" className={`${styles.mName} ${styles.mNameBtn}`} onClick={() => onEdit(h)} aria-label={`Edit ${h.name}`}>
                <strong>{h.name}</strong>
                <small>{h.weekdays.length === 7 ? `${done}/${sched} so far` : slash(h)}</small>
              </button>
              {cells.map((st, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.cell} ${CELL[st]}`}
                  disabled={st === 'off' || st === 'planned'}
                  onClick={() => toggle.mutate({ habitId: h.id, date: localDateStr(days[i]), done: st === 'done' })}
                  aria-label={`${h.name} ${localDateStr(days[i])}`}
                >
                  {st === 'done' && <Check size={11} />}
                  {st === 'missed' && <X size={11} />}
                  {st === 'planned' && <Circle size={9} />}
                  {st === 'off' && <Minus size={10} />}
                </button>
              ))}
            </div>
          ))}
          {rows.length === 0 && <p className={styles.empty}>No habits yet. Add your first routine below.</p>}
        </div>
      </section>

      {shown.length > 0 && (
        <>
          <div className={styles.sectionHead}>
            <span>Daily Momentum Breakdown</span>
            <small className={styles.accentSm}>Week {isoWeek(weekStart)} Progress</small>
          </div>
          <div className={styles.breakdown}>
            {shown.map((d) => {
              const s = dayStats(habits, ix, d)
              const isToday = localDateStr(d) === todayStr
              const pct = s.scheduled ? Math.round((s.done / s.scheduled) * 100) : 0
              return (
                <div key={localDateStr(d)} className={`${styles.dayCard} ${isToday ? styles.dayCardToday : ''}`}>
                  <small>{isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })} {d.getDate()}</small>
                  <strong>{isToday ? `${s.done}/${s.scheduled} Done` : `${pct}%`}</strong>
                  <span className={styles.miniBar}><i style={{ width: `${pct}%` }} /></span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {next && NextIcon && (
        <section className={styles.nextCard}>
          <span className={styles.iconBox}><NextIcon size={16} /></span>
          <div className={styles.rowText}>
            <strong>{next.name} <em className={styles.badge}>{currentStreak(next, ix, today)}d streak</em></strong>
            <small>{timeOfDay(next.reminder_time)} routine • {pendingToday.length} remaining today</small>
          </div>
          <button type="button" className={styles.checkBtn} onClick={() => toggle.mutate({ habitId: next.id, date: todayStr, done: false })}>
            <Check size={14} /> Check
          </button>
        </section>
      )}

      <div className={styles.twoCards}>
        <section className={styles.miniCard}>
          <span className={styles.cap}><AlarmClock size={12} /> PEAK WINDOW</span>
          <strong>{peak ? `${hourLabel(peak.hr)} – ${hourLabel(peak.hr + 1)}` : '—'}</strong>
          <small>{peak ? `${peak.pct}% completion adherence` : 'Set reminder times to unlock'}</small>
        </section>
        <section className={styles.miniCard}>
          <span className={styles.cap}><CheckCircle2 size={12} /> TOTAL OUTPUT</span>
          <strong>{week.done} Completed</strong>
          <small>{prevWeek.scheduled > 0 ? `${diff >= 0 ? '+' : ''}${diff} vs previous cycle` : 'First cycle'}</small>
        </section>
      </div>

      <span className={styles.cap}>IGNITE NEW ROUTINE</span>
      <div className={styles.quick}>
        <Zap size={16} />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="e.g. Cold Shower 2m, Journaling..." />
        <button type="button" className={styles.addBtn} onClick={addQuick} disabled={!quick.trim() || create.isPending}><Plus size={14} /> Add</button>
      </div>
    </>
  )
}