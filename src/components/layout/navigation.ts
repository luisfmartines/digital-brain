import { CalendarDays, Dumbbell, Home, ListChecks, Wallet } from 'lucide-react'

export const MAIN_NAVIGATION = [
  { to: '/', label: 'Início', icon: Home, modules: [] },
  { to: '/routine', label: 'Rotina', icon: ListChecks, modules: ['tasks', 'habits'] },
  { to: '/workouts', label: 'Treinos', icon: Dumbbell, modules: ['workouts'] },
  { to: '/finance', label: 'Finanças', icon: Wallet, modules: ['finance'] },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays, modules: ['calendar'] },
]

export function mainNavigation(enabled: string[]) {
  return MAIN_NAVIGATION.filter(({ modules }) => !modules.length || modules.some((module) => enabled.includes(module)))
}
