export const EVENT_CATEGORIES = {
  work: 'Trabalho',
  meeting: 'Reunião',
  health: 'Saúde',
  personal: 'Pessoal',
} as const

export const TASK_CATEGORIES = {
  ...EVENT_CATEGORIES,
  fitness: 'Condicionamento',
  mindset: 'Mentalidade',
} as const

export type EventCategory = keyof typeof EVENT_CATEGORIES
export type TaskCategory = keyof typeof TASK_CATEGORIES

export function eventCategory(value: unknown): EventCategory {
  if (value === 'fitness') return 'health'
  return typeof value === 'string' && Object.hasOwn(EVENT_CATEGORIES, value) ? value as EventCategory : 'personal'
}

export function taskCategory(value: unknown): TaskCategory {
  return typeof value === 'string' && Object.hasOwn(TASK_CATEGORIES, value) ? value as TaskCategory : 'personal'
}
