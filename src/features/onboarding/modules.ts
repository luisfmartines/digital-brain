import { BrainCircuit, CalendarDays, CheckCircle2, Flame, Maximize2, Wallet, type LucideIcon } from 'lucide-react'

export interface ModuleInfo {
  id: string
  title: string
  desc: string
  icon: LucideIcon
  badge?: string
}

export const MODULES: ModuleInfo[] = [
  { id: 'habits', title: 'Hábitos e Consistência', desc: 'Microsequências, gatilhos de identidade e ciclos de recompensa.', icon: Flame, badge: 'Essencial' },
  { id: 'tasks', title: 'Tarefas e Checklists', desc: 'Caixa de entrada organizada e prioridades claras.', icon: CheckCircle2 },
  { id: 'workouts', title: 'Treinos e Hipertrofia', desc: 'Acompanhamento de esforço, volume e recuperação.', icon: Maximize2 },
  { id: 'finance', title: 'Finanças e Capital', desc: 'Fluxo de caixa, metas de economia e reserva.', icon: Wallet, badge: 'R$ BRL' },
  { id: 'calendar', title: 'Calendário e Agenda', desc: 'Organização do tempo e alinhamento com sua rotina.', icon: CalendarDays },
  { id: 'assistant', title: 'Assistente Neural de IA', desc: 'Insights automáticos, síntese e resumo diário.', icon: BrainCircuit },
]