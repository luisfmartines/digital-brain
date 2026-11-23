import { supabase } from '../../lib/supabase'
import type { OnboardingData } from './types'

const CATEGORY_BY_ICON: Record<string, string> = {
  meditation: 'mindfulness',
  read: 'mindfulness',
  water: 'health',
  cold: 'health',
  deepwork: 'discipline',
}

export async function saveOnboarding(userId: string, data: OnboardingData) {
  const finance = data.modules.includes('finance')

  const { error: settingsError } = await supabase.from('user_settings').upsert({
    user_id: userId,
    monthly_income: finance ? data.monthlyIncome : null,
    savings_goal: finance ? Math.round(data.monthlyIncome * data.savingsPct) / 100 : null,
    mvh_protocol: data.mvhProtocol,
    weekend_elasticity: data.weekendElasticity,
    streak_grace_days: 1,
  })
  if (settingsError) throw settingsError

  const active = data.habits.filter((h) => h.active)
  const rows = active.map((h) => ({
    user_id: userId,
    name: h.name,
    icon: h.icon,
    anchor_cue: h.anchorCue || null,
    reminder_time: `${h.time}:00`,
    weekdays: h.weekdays,
    category: CATEGORY_BY_ICON[h.icon] ?? 'discipline',
  }))
  // O hábito de água sempre vem pronto (o usuário só ajusta a meta depois)
  if (!rows.some((r) => r.icon === 'water')) {
    rows.unshift({
      user_id: userId, name: 'Drink 2.5L Water', icon: 'water', anchor_cue: 'Refill your flask with every work sprint',
      reminder_time: '09:00:00', weekdays: [0, 1, 2, 3, 4, 5, 6], category: 'health',
    })
  }
  const { error } = await supabase.from('habits').insert(rows)
  if (error) throw error

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