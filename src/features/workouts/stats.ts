import { addDays, startOfWeek } from '../../lib/date'
import { muscleLabel, volumeOf, workoutSeconds, type SetLike } from './utils'

export interface LogSet extends SetLike { exercise: { name: string; muscle_group: string } | null }
export interface LogWorkout {
  id: string; name: string; started_at: string; ended_at: string; paused_seconds: number; workout_sets: LogSet[]
  activity_category?: string | null; distance_km?: number | null
}

export type Period = '3m' | '1y' | 'all'

export interface Metric {
  id: string; name: string; at: Date
  volume: number; minutes: number; reps: number; sets: number; pct: number
  w: LogWorkout
}

export function toMetrics(list: LogWorkout[]): Metric[] {
  return list.map((w) => {
    const done = w.workout_sets.filter((s) => s.completed && !s.is_warmup)
    return {
      id: w.id,
      name: w.name,
      at: new Date(w.ended_at),
      volume: volumeOf(w.workout_sets),
      minutes: workoutSeconds({ ...w, paused_at: null }, 0) / 60,
      reps: done.reduce((a, s) => a + (s.reps ?? 0), 0),
      sets: done.length,
      pct: w.activity_category ? 100 : w.workout_sets.length ? Math.round((w.workout_sets.filter((s) => s.completed).length / w.workout_sets.length) * 100) : 0,
      w,
    }
  })
}

/* ---------- Janela do período ---------- */

export function periodWindow(p: Period, now: Date, first: Date | null) {
  if (p === '3m') {
    const from = addDays(startOfWeek(now), -12 * 7)
    return { from, prevFrom: addDays(from, -13 * 7) as Date | null }
  }
  if (p === '1y') {
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    return { from, prevFrom: new Date(from.getFullYear(), from.getMonth() - 12, 1) as Date | null }
  }
  const base = first ?? now
  return { from: new Date(base.getFullYear(), base.getMonth(), 1), prevFrom: null as Date | null }
}

export interface Bucket { start: Date; label: string; long: string; volume: number; minutes: number; workouts: number }

const MON = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short' })
const DAY = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })

export function makeBuckets(p: Period, from: Date, now: Date): Bucket[] {
  const empty = (start: Date, label: string, long: string): Bucket => ({ start, label, long, volume: 0, minutes: 0, workouts: 0 })
  if (p === '3m') {
    return Array.from({ length: 13 }, (_, i) => {
      const s = addDays(from, i * 7)
      return empty(s, DAY(s), `Semana de ${DAY(s)}`)
    })
  }
  const months = (now.getFullYear() - from.getFullYear()) * 12 + now.getMonth() - from.getMonth() + 1
  const step = p === 'all' && months > 18 ? 3 : 1
  const out: Bucket[] = []
  for (let m = 0; m < months; m += step) {
    const s = new Date(from.getFullYear(), from.getMonth() + m, 1)
    const e = new Date(from.getFullYear(), from.getMonth() + m + step - 1, 1)
    const yy = `’${String(s.getFullYear()).slice(2)}`
    const label = p === 'all' ? `${MON(s)} ${yy}` : MON(s)
    const long = step === 1
      ? s.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : `${MON(s)} ${s.getFullYear()} – ${MON(e)} ${e.getFullYear()}`
    out.push(empty(s, label, long))
  }
  return out
}

export function bucketize(ms: Metric[], buckets: Bucket[]): Bucket[] {
  const out = buckets.map((b) => ({ ...b }))
  for (const m of ms) {
    let idx = -1
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].start <= m.at) { idx = i; break }
    }
    if (idx < 0) continue
    out[idx].volume += m.volume
    out[idx].minutes += m.minutes
    out[idx].workouts += 1
  }
  return out
}

/* ---------- Totais ---------- */

export interface Summary { workouts: number; volume: number; minutes: number; reps: number; sets: number; weeks: number }

export function summarize(ms: Metric[]): Summary {
  const weeks = new Set(ms.map((m) => startOfWeek(m.at).getTime()))
  return {
    workouts: ms.length,
    volume: ms.reduce((a, m) => a + m.volume, 0),
    minutes: ms.reduce((a, m) => a + m.minutes, 0),
    reps: ms.reduce((a, m) => a + m.reps, 0),
    sets: ms.reduce((a, m) => a + m.sets, 0),
    weeks: weeks.size,
  }
}

export const pctChange = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

export function breakdown(ms: Metric[], by: 'muscle' | 'exercise', top = 5): { label: string; reps: number }[] {
  const acc = new Map<string, number>()
  for (const m of ms) {
    for (const s of m.w.workout_sets) {
      if (!s.completed || s.is_warmup || !s.reps) continue
      const label = !s.exercise ? 'Outros' : by === 'muscle' ? muscleLabel(s.exercise.muscle_group) : s.exercise.name
      acc.set(label, (acc.get(label) ?? 0) + s.reps)
    }
  }
  return [...acc.entries()].map(([label, reps]) => ({ label, reps })).sort((a, b) => b.reps - a.reps).slice(0, top)
}
