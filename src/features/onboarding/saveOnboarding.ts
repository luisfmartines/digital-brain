import { supabase } from '../../lib/supabase'
import type { OnboardingData } from './types'

export async function saveOnboarding(userId: string, data: OnboardingData) {
  const workouts = data.modules.includes('workouts')
  const finance = data.modules.includes('finance')

  const { error: settingsError } = await supabase.from('user_settings').upsert({
    user_id: userId,
    monthly_income: finance ? data.monthlyIncome : null,
    savings_goal: finance ? Math.round(data.monthlyIncome * data.savingsPct) / 100 : null,
    training_goal: workouts ? data.trainingGoal : null,
    experience_level: workouts ? data.experience : null,
    weekly_frequency: workouts ? data.weeklyFrequency : null,
    mvh_protocol: data.mvhProtocol,
    weekend_elasticity: data.weekendElasticity,
    streak_grace_days: 1,
  })
  if (settingsError) throw settingsError

  const active = data.habits.filter((h) => h.active)
  if (active.length > 0) {
    const { error } = await supabase.from('habits').insert(
      active.map((h) => ({
        user_id: userId,
        name: h.name,
        icon: h.icon,
        anchor_cue: h.anchorCue || null,
        reminder_time: `${h.time}:00`,
        weekdays: h.weekdays,
      }))
    )
    if (error) throw error
  }

  const { error: xpError } = await supabase
    .from('xp_events')
    .insert({ user_id: userId, source: 'onboarding', amount: 100 })
  if (xpError) throw xpError

  // Por último: só marca como concluído se tudo acima deu certo
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ enabled_modules: data.modules, onboarding_completed: true })
    .eq('id', userId)
  if (profileError) throw profileError
}