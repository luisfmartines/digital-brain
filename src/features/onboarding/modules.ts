import { BrainCircuit, CalendarDays, CheckCircle2, Flame, Maximize2, Wallet, type LucideIcon } from 'lucide-react'

export interface ModuleInfo {
  id: string
  title: string
  desc: string
  icon: LucideIcon
  badge?: string
}

export const MODULES: ModuleInfo[] = [
  { id: 'habits', title: 'Habits & Consistency', desc: 'Micro-streaks, identity triggers, dopamine loops.', icon: Flame, badge: 'Core' },
  { id: 'tasks', title: 'Tasks & Checklists', desc: 'Frictionless inbox zero, prioritization matrices.', icon: CheckCircle2 },
  { id: 'workouts', title: 'Workouts & Hypertrophy', desc: 'RPE tracking, volume progression & recovery score.', icon: Maximize2 },
  { id: 'finance', title: 'Finance & Capital', desc: 'Cashflow forecasting, savings rate, runway metrics.', icon: Wallet, badge: 'R$ BRL' },
  { id: 'calendar', title: 'Calendar & Schedule', desc: 'Timeblocking chronobiology & circadian alignment.', icon: CalendarDays },
  { id: 'assistant', title: 'AI Neural Assistant', desc: 'Autonomous insights, synthesis & daily briefing.', icon: BrainCircuit },
]