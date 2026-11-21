import { DAYS } from './habitPresets'

export const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function weekdaysLabel(days: number[]) {
  const set = new Set(days)
  if (set.size === 7) return 'Daily'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Mon-Fri'
  return DAYS.filter((d) => set.has(d.v)).map((d) => d.label).join(', ') || 'No days'
}