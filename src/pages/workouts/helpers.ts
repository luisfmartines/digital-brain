export { estimateMinutes, fmtNum, mins, muscleLabel, relDays } from '../../features/workouts/utils'
export const weekdayShort = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short' })