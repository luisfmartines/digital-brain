import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { localDateStr } from '../../lib/date'

export const WATER_STEP = 500 // ml
export const WATER_MIN = 500
export const WATER_MAX = 6000
export const WATER_DEFAULT = 2500

export const litersLabel = (ml: number) => `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
export const waterHabitName = (goalMl: number) => `Beber ${litersLabel(goalMl)} de água`

/* ---------- Funções de apoio (sem React) ---------- */

export async function fetchWaterGoal(): Promise<number> {
  const { data, error } = await supabase.from('user_settings').select('water_goal_ml').maybeSingle()
  if (error) throw error
  return Number(data?.water_goal_ml ?? WATER_DEFAULT)
}

export async function fetchWaterMl(date: string): Promise<number> {
  const { data, error } = await supabase.from('water_logs').select('ml').eq('log_date', date)
  if (error) throw error
  return ((data ?? []) as { ml: number }[]).reduce((a, l) => a + l.ml, 0)
}

export async function findWaterHabitId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('habits').select('id').eq('icon', 'water').is('deleted_at', null).is('archived_at', null)
    .order('created_at').limit(1)
  if (error) throw error
  return ((data ?? [])[0] as { id: string } | undefined)?.id ?? null
}

async function setHabitLog(habitId: string, date: string, done: boolean) {
  if (!done) {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date)
    if (error) throw error
    return
  }
  const { data, error } = await supabase.from('habit_logs').select('habit_id').eq('habit_id', habitId).eq('log_date', date).limit(1)
  if (error) throw error
  if ((data ?? []).length) return
  const { error: insertError } = await supabase.from('habit_logs').insert({ habit_id: habitId, log_date: date })
  if (insertError) throw insertError
}

// Hábito de água concluído  <=>  bebeu pelo menos a meta do dia
export async function reconcileWaterHabit(date: string) {
  const habitId = await findWaterHabitId()
  if (!habitId) return
  const [ml, goal] = await Promise.all([fetchWaterMl(date), fetchWaterGoal()])
  await setHabitLog(habitId, date, ml >= goal)
}

// Marcar / desmarcar o hábito de água manualmente (pela tela de hábitos ou pela home)
export async function toggleWaterHabit(habitId: string, date: string, done: boolean) {
  if (done) {
    // desfazer: zera a água do dia e remove o check
    const { error } = await supabase.from('water_logs').delete().eq('log_date', date)
    if (error) throw error
    await setHabitLog(habitId, date, false)
    return
  }
  const [ml, goal] = await Promise.all([fetchWaterMl(date), fetchWaterGoal()])
  if (goal - ml > 0) {
    const { error } = await supabase.from('water_logs').insert({ log_date: date, ml: goal - ml })
    if (error) throw error
  }
  await setHabitLog(habitId, date, true)
}

function useInvalidateWater() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['home', 'water'] })
    qc.invalidateQueries({ queryKey: ['home', 'habits'] })
    qc.invalidateQueries({ queryKey: ['habits'] })
    qc.invalidateQueries({ queryKey: ['calendar', 'schedule'] })
  }
}

/* ---------- Hooks ---------- */

export function useWater() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'water', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ml, goal] = await Promise.all([fetchWaterMl(localDateStr()), fetchWaterGoal()])
      return { ml, goal }
    },
  })
}

// Soma água do dia e, se bateu a meta, conclui o hábito de água sozinho
export function useAddWater() {
  const invalidate = useInvalidateWater()
  return useMutation({
    mutationFn: async (ml: number) => {
      const today = localDateStr()
      const { error } = await supabase.from('water_logs').insert({ log_date: today, ml })
      if (error) throw error
      await reconcileWaterHabit(today)
    },
    onSuccess: invalidate,
  })
}

// A única coisa que o usuário edita: quanto quer beber por dia (de 500 em 500 ml)
export function useSetWaterGoal() {
  const { user } = useAuth()
  const invalidate = useInvalidateWater()
  return useMutation({
    mutationFn: async (goalMl: number) => {
      const goal = Math.min(WATER_MAX, Math.max(WATER_MIN, Math.round(goalMl / WATER_STEP) * WATER_STEP))
      const { error } = await supabase.from('user_settings').upsert({ user_id: user!.id, water_goal_ml: goal })
      if (error) throw error
      const { error: nameError } = await supabase
        .from('habits').update({ name: waterHabitName(goal) }).eq('icon', 'water').is('deleted_at', null)
      if (nameError) throw nameError
      await reconcileWaterHabit(localDateStr())
    },
    onSuccess: invalidate,
  })
}

// O hábito de água já "vem pronto": se o usuário ainda não tem, ele é criado uma vez
export function useEnsureWaterHabit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['water-habit', user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      if (await findWaterHabitId()) return true
      const goal = await fetchWaterGoal()
      const { error } = await supabase.from('habits').insert({
        name: waterHabitName(goal),
        icon: 'water',
        category: 'health',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        reminder_time: '09:00:00',
        anchor_cue: 'Reencher sua garrafa a cada bloco de trabalho',
      })
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['calendar', 'schedule'] })
      qc.invalidateQueries({ queryKey: ['home', 'habits'] })
      return true
    },
  })
}
