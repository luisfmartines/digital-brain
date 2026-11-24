import type { SetType } from './setTypes'

export interface HistSet { id: string; set_number: number; weight_kg: number | null; reps: number | null; is_warmup: boolean; set_type?: SetType | null }
export interface HistSession { id: string; name: string; at: Date; sets: HistSet[] }

export type MetricId = 'weight' | 'reps' | 'volume' | 'sessionReps'

export const METRICS: { id: MetricId; label: string; unit: string }[] = [
  { id: 'weight', label: 'Maior peso', unit: 'kg' },
  { id: 'reps', label: 'Mais repetições (série)', unit: 'reps' },
  { id: 'volume', label: 'Volume da sessão', unit: 'kg' },
  { id: 'sessionReps', label: 'Repetições da sessão', unit: 'reps' },
]

const work = (s: HistSession) => s.sets.filter((x) => !x.is_warmup)
const num = (n: number | null) => n ?? 0

export function metricValue(s: HistSession, m: MetricId): number {
  const ws = work(s)
  switch (m) {
    case 'weight': return Math.max(0, ...ws.map((x) => num(x.weight_kg)))
    case 'reps': return Math.max(0, ...ws.map((x) => num(x.reps)))
    case 'volume': return ws.reduce((a, x) => a + num(x.weight_kg) * num(x.reps), 0)
    case 'sessionReps': return ws.reduce((a, x) => a + num(x.reps), 0)
  }
}

export const hasWeight = (list: HistSession[]) => list.some((s) => work(s).some((x) => num(x.weight_kg) > 0))

export interface Records { maxWeight: number | null; maxReps: number; best1rm: number | null; bestSetVolume: number | null; bestSessionVolume: number }

// 1RM estimado (fórmula de Epley)
const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))

export function records(list: HistSession[]): Records {
  const sets = list.flatMap(work)
  const weighted = sets.filter((x) => num(x.weight_kg) > 0 && num(x.reps) > 0)
  return {
    maxWeight: weighted.length ? Math.max(...weighted.map((x) => num(x.weight_kg))) : null,
    maxReps: Math.max(0, ...sets.map((x) => num(x.reps))),
    best1rm: weighted.length ? Math.max(...weighted.map((x) => epley(num(x.weight_kg), num(x.reps)))) : null,
    bestSetVolume: weighted.length ? Math.max(...weighted.map((x) => num(x.weight_kg) * num(x.reps))) : null,
    bestSessionVolume: Math.max(0, ...list.map((s) => metricValue(s, 'volume'))),
  }
}

export type RangeId = '3m' | '1y' | 'all'
export const RANGES: { id: RangeId; label: string }[] = [
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '1y', label: 'Último ano' },
  { id: 'all', label: 'Todo o período' },
]

export function inRange(list: HistSession[], r: RangeId, now = new Date()) {
  if (r === 'all') return list
  const from = new Date(now)
  if (r === '3m') from.setMonth(from.getMonth() - 3)
  else from.setFullYear(from.getFullYear() - 1)
  return list.filter((s) => s.at >= from)
}
