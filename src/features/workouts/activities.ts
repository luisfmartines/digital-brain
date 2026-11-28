export const ACTIVITIES = [
  'Musculação', 'Jiu-jitsu', 'Boxe', 'Corrida', 'Caminhada', 'Ciclismo',
  'Natação', 'Muay thai', 'Treino funcional', 'Calistenia', 'Pilates', 'Yoga',
  'Dança', 'Remo', 'Futebol', 'Vôlei', 'CrossFit', 'Hyrox', 'HIIT', 'Circuito',
  'Powerlifting', 'Strongman', 'Levantamento olímpico', 'Resistência', 'MetCon', 'MMA', 'Outro',
] as const

export type ActivityCategory = typeof ACTIVITIES[number]

const kilometers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
export const formatDistance = (distance: number) => kilometers.format(distance) + ' km'
