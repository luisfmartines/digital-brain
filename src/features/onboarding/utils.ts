import { DAYS } from './habitPresets'

export const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function weekdaysLabel(days: number[]) {
  const set = new Set(days)
  if (set.size === 7) return 'Todos os dias'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Segunda a sexta'
  return DAYS.filter((d) => set.has(d.v)).map((d) => d.label).join(', ') || 'Nenhum dia'
}