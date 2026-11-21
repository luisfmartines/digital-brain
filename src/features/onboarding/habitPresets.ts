import type { HabitDraft } from './types'

const ALL = [0, 1, 2, 3, 4, 5, 6]
const WEEK = [1, 2, 3, 4, 5]

export const DAYS = [
  { label: 'Mon', letter: 'M', v: 1 },
  { label: 'Tue', letter: 'T', v: 2 },
  { label: 'Wed', letter: 'W', v: 3 },
  { label: 'Thu', letter: 'T', v: 4 },
  { label: 'Fri', letter: 'F', v: 5 },
  { label: 'Sat', letter: 'S', v: 6 },
  { label: 'Sun', letter: 'S', v: 0 },
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
  { key: 'meditation', name: 'Morning Meditation', icon: 'meditation', subtitle: '15 min daily mindful focus', loopSubtitle: 'Mindful Focus • Grounding Ritual', tag: '15m', anchorCue: 'Immediately after waking & cold water', time: '07:15', weekdays: ALL },
  { key: 'water', name: 'Drink 2.5L Water', icon: 'water', subtitle: 'Cellular hydration baseline', loopSubtitle: 'Bio-Performance • Cellular Drive', tag: '3 Milestones', anchorCue: 'Refill 800ml flask with every work sprint', time: '09:00', weekdays: ALL },
  { key: 'read', name: 'Read 20 pages', icon: 'read', subtitle: 'Compound knowledge absorption', loopSubtitle: 'Knowledge Synthesis • Deep Mind', tag: 'Compound', anchorCue: 'Evening wind-down before screen curfew', time: '21:30', weekdays: WEEK },
  { key: 'deepwork', name: 'Deep Work Block', icon: 'deepwork', subtitle: '90 min uninterrupted output', loopSubtitle: 'Flow State • Deep Output', tag: '90m', anchorCue: 'After breakfast, phone in another room', time: '09:30', weekdays: WEEK },
  { key: 'cold', name: 'Cold Shower', icon: 'cold', subtitle: 'Vascular tone & dopamine reset', loopSubtitle: 'Resilience • Dopamine Reset', tag: '3m', anchorCue: 'Right after the gym', time: '18:30', weekdays: ALL },
]

export const toDraft = (p: HabitPreset): HabitDraft => ({
  key: p.key, name: p.name, icon: p.icon, subtitle: p.subtitle, loopSubtitle: p.loopSubtitle,
  tag: p.tag, anchorCue: p.anchorCue, time: p.time, weekdays: [...p.weekdays], active: true,
})

export const customDraft = (name: string): HabitDraft => ({
  key: `custom-${Date.now()}`, name, icon: 'custom', subtitle: 'Custom identity loop',
  loopSubtitle: 'Custom • Identity Loop', tag: 'Custom', anchorCue: '', time: '09:00',
  weekdays: [...ALL], active: true,
})