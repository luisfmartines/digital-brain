import type { Dispatch, SetStateAction } from 'react'
import { PRESETS, toDraft } from './habitPresets'

export interface HabitDraft {
  key: string
  name: string
  icon: string
  subtitle: string
  loopSubtitle: string
  tag: string
  anchorCue: string
  time: string // HH:MM
  weekdays: number[] // 0 = domingo ... 6 = sábado
  active: boolean
}

export interface OnboardingData {
  modules: string[]
  monthlyIncome: number
  savingsPct: number
  habits: HabitDraft[]
  mvhProtocol: boolean
  weekendElasticity: boolean
}

export interface OnboardingCtx {
  data: OnboardingData
  setData: Dispatch<SetStateAction<OnboardingData>>
}

export const defaultOnboardingData: OnboardingData = {
  modules: ['habits', 'tasks', 'workouts', 'finance', 'calendar', 'assistant'],
  monthlyIncome: 0,
  savingsPct: 25,
  habits: PRESETS.slice(0, 3).map(toDraft),
  mvhProtocol: true,
  weekendElasticity: false,
}