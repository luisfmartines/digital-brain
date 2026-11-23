import type { HabitDraft } from './types'

const ALL = [0, 1, 2, 3, 4, 5, 6]
const WEEK = [1, 2, 3, 4, 5]

export const DAYS = [
  { label: 'Seg', letter: 'S', v: 1 },
  { label: 'Ter', letter: 'T', v: 2 },
  { label: 'Qua', letter: 'Q', v: 3 },
  { label: 'Qui', letter: 'Q', v: 4 },
  { label: 'Sex', letter: 'S', v: 5 },
  { label: 'Sáb', letter: 'S', v: 6 },
  { label: 'Dom', letter: 'D', v: 0 },
]

export interface HabitPreset {
  key: string
  name: string
  icon: string
  subtitle: string
  loopSubtitle: string
  tag: string
  anchorCue: string
  time: string
  weekdays: number[]
}

export const PRESETS: HabitPreset[] = [
  { key: 'meditation', name: 'Meditação da manhã', icon: 'meditation', subtitle: '15 min de foco consciente por dia', loopSubtitle: 'Foco Consciente • Ritual de Aterramento', tag: '15 min', anchorCue: 'Logo após acordar e beber água', time: '07:15', weekdays: ALL },
  { key: 'water', name: 'Beber 2,5 L de água', icon: 'water', subtitle: 'Hidratação corporal diária', loopSubtitle: 'Bioperformance • Energia Celular', tag: '3 marcos', anchorCue: 'Reencher a garrafa a cada bloco de trabalho', time: '09:00', weekdays: ALL },
  { key: 'read', name: 'Ler 20 páginas', icon: 'read', subtitle: 'Aquisição contínua de conhecimento', loopSubtitle: 'Síntese do Conhecimento • Mente Profunda', tag: 'Constante', anchorCue: 'Ao relaxar à noite, antes de parar de usar telas', time: '21:30', weekdays: WEEK },
  { key: 'deepwork', name: 'Bloco de trabalho profundo', icon: 'deepwork', subtitle: '90 min de produção sem interrupções', loopSubtitle: 'Fluxo • Produção Profunda', tag: '90 min', anchorCue: 'Depois do café da manhã, com o celular em outro lugar', time: '09:30', weekdays: WEEK },
  { key: 'cold', name: 'Banho frio', icon: 'cold', subtitle: 'Revigorar o corpo e a disposição', loopSubtitle: 'Resiliência • Renovação da Energia', tag: '3 min', anchorCue: 'Logo depois do treino', time: '18:30', weekdays: ALL },
]

export const toDraft = (p: HabitPreset): HabitDraft => ({
  key: p.key, name: p.name, icon: p.icon, subtitle: p.subtitle, loopSubtitle: p.loopSubtitle,
  tag: p.tag, anchorCue: p.anchorCue, time: p.time, weekdays: [...p.weekdays], active: true,
})

export const customDraft = (name: string): HabitDraft => ({
  key: `custom-${Date.now()}`, name, icon: 'custom', subtitle: 'Ciclo personalizado de identidade',
  loopSubtitle: 'Personalizado • Ciclo de Identidade', tag: 'Personalizado', anchorCue: '', time: '09:00',
  weekdays: [...ALL], active: true,
})