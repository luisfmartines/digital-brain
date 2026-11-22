import { addDays, localDateStr, parseDate } from '../../lib/date'
import { fmtTime } from '../onboarding/utils'

export interface Habit {
  id: string
  name: string
  icon: string | null
  category: string
  weekdays: number[] // 0 = domingo ... 6 = sábado
  reminder_time: string | null
  created_at: string
}
export interface Log {
  habit_id: string
  log_date: string
}

export const CATEGORIES = [
  { id: 'health', label: 'Health & Wellness' },
  { id: 'mindfulness', label: 'Mindfulness & Knowledge' },
  { id: 'fitness', label: 'Fitness & Movement' },
  { id: 'discipline', label: 'Discipline & Nutrition' },
]

export function buildIndex(logs: Log[]) {
  const set = new Set<string>()
  const byDay = new Map<string, number>()
  const byHabit = new Map<string, number>()
  for (const l of logs) {
    set.add(`${l.habit_id}|${l.log_date}`)
    byDay.set(l.log_date, (byDay.get(l.log_date) ?? 0) + 1)
    byHabit.set(l.habit_id, (byHabit.get(l.habit_id) ?? 0) + 1)
  }
  return { set, byDay, byHabit, logs }
}
export type Index = ReturnType<typeof buildIndex>

export const isDone = (ix: Index, habitId: string, date: string) => ix.set.has(`${habitId}|${date}`)

const createdStr = (h: Habit) => localDateStr(new Date(h.created_at))
export const isScheduled = (h: Habit, d: Date) => h.weekdays.includes(d.getDay()) && localDateStr(d) >= createdStr(h)

export function dayStats(habits: Habit[], ix: Index, d: Date) {
  const ds = localDateStr(d)
  let scheduled = 0
  let done = 0
  for (const h of habits) {
    if (!isScheduled(h, d)) continue
    scheduled++
    if (isDone(ix, h.id, ds)) done++
  }
  return { scheduled, done }
}

export function rangeStats(habits: Habit[], ix: Index, from: Date, to: Date) {
  let scheduled = 0
  let done = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = dayStats(habits, ix, d)
    scheduled += s.scheduled
    done += s.done
  }
  return { scheduled, done, pct: scheduled ? Math.round((done / scheduled) * 100) : 0 }
}

// -1 = sem hábitos no dia | 0 = nada feito | 1..4 = intensidade
export const level = (pct: number | null) =>
  pct === null ? -1 : pct === 0 ? 0 : pct < 34 ? 1 : pct < 67 ? 2 : pct < 100 ? 3 : 4

export function dayLevel(habits: Habit[], ix: Index, d: Date) {
  const s = dayStats(habits, ix, d)
  return s.scheduled ? level(Math.round((s.done / s.scheduled) * 100)) : -1
}

export type CellState = 'done' | 'missed' | 'pending' | 'planned' | 'off'
export function cellState(h: Habit, ix: Index, d: Date, today: Date): CellState {
  if (!isScheduled(h, d)) return 'off'
  if (isDone(ix, h.id, localDateStr(d))) return 'done'
  if (d < today) return 'missed'
  if (d.getTime() === today.getTime()) return 'pending'
  return 'planned'
}

export const byTime = (a: Habit, b: Habit) => (a.reminder_time ?? '99').localeCompare(b.reminder_time ?? '99')

export function timeOfDay(t: string | null) {
  if (!t) return 'Anytime'
  const h = Number(t.slice(0, 2))
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
}

// Dias seguidos (nos dias agendados) até hoje
export function currentStreak(h: Habit, ix: Index, today: Date) {
  const start = createdStr(h)
  let streak = 0
  for (let i = 0; i < 800; i++) {
    const d = addDays(today, -i)
    const ds = localDateStr(d)
    if (ds < start) break
    if (!h.weekdays.includes(d.getDay())) continue
    if (isDone(ix, h.id, ds)) streak++
    else if (i === 0) continue // hoje ainda não quebra a sequência
    else break
  }
  return streak
}

export function longestStreak(h: Habit, ix: Index, today: Date) {
  const todayStr = localDateStr(today)
  let best = 0
  let cur = 0
  for (let d = parseDate(createdStr(h)); d <= today; d = addDays(d, 1)) {
    if (!h.weekdays.includes(d.getDay())) continue
    const ds = localDateStr(d)
    if (isDone(ix, h.id, ds)) {
      cur++
      if (cur > best) best = cur
    } else if (ds !== todayStr) cur = 0
  }
  return best
}

export function rowSub(h: Habit, streak: number) {
  const when = h.reminder_time ? fmtTime(h.reminder_time) : timeOfDay(h.reminder_time)
  return `${when} • ${streak > 0 ? `${streak} days streak` : 'Start your streak'}`
}

export function nextRun(h: Habit, today: Date) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i)
    if (h.weekdays.includes(d.getDay())) return i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return '—'
}

export function countLogs(ix: Index, from: Date, to: Date) {
  const a = localDateStr(from)
  const b = localDateStr(to)
  let n = 0
  for (const [d, c] of ix.byDay) if (d >= a && d <= b) n += c
  return n
}

export function activeDays(ix: Index, from: Date, to: Date) {
  const a = localDateStr(from)
  const b = localDateStr(to)
  let n = 0
  for (const d of ix.byDay.keys()) if (d >= a && d <= b) n++
  return n
}

// Combinação hábito + dia da semana com menor aderência nos últimos 90 dias
export function weakestSlot(habits: Habit[], ix: Index, today: Date) {
  let worst: { habit: Habit; weekday: number; rate: number } | null = null
  for (const h of habits) {
    for (const wd of h.weekdays) {
      let sched = 0
      let done = 0
      for (let i = 1; i <= 90; i++) {
        const day = addDays(today, -i)
        if (day.getDay() !== wd || !isScheduled(h, day)) continue
        sched++
        if (isDone(ix, h.id, localDateStr(day))) done++
      }
      if (sched >= 3 && done < sched) {
        const rate = done / sched
        if (!worst || rate < worst.rate) worst = { habit: h, weekday: wd, rate }
      }
    }
  }
  return worst
}