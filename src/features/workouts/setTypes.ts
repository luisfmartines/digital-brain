export const SET_TYPES = [
  { value: 'normal', label: 'Normal', short: '' },
  { value: 'warmup', label: 'Aquecimento', short: 'AQ' },
  { value: 'preparatory', label: 'Preparatória', short: 'PR' },
  { value: 'drop_set', label: 'Drop-set', short: 'DS' },
  { value: 'bi_set', label: 'Bi-set', short: 'BS' },
] as const

export type SetType = typeof SET_TYPES[number]['value']

export function setTypeOf(set: { set_type?: SetType | null; is_warmup: boolean }) {
  const type = set.set_type ?? (set.is_warmup ? 'warmup' : 'normal')
  return SET_TYPES.find(({ value }) => value === type) ?? SET_TYPES[0]
}

export function isPreparation(type: SetType) {
  return type === 'warmup' || type === 'preparatory'
}

export const MAX_REST_SECONDS = 5 * 60

function restLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return [minutes ? minutes + ' min' : '', remainder ? remainder + ' s' : ''].filter(Boolean).join(' ')
}

export const REST_OPTIONS = Array.from({ length: MAX_REST_SECONDS / 30 }, (_, index) => {
  const value = (index + 1) * 30
  return { value, label: restLabel(value) }
})

export function normalizeRest(seconds: number) {
  return Number.isFinite(seconds) ? Math.min(MAX_REST_SECONDS, Math.max(30, Math.round(seconds / 30) * 30)) : 90
}
