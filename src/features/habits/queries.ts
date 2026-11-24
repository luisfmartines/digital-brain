import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { toggleWaterHabit } from '../water/queries'
import type { Habit, Log } from './stats'

export function useHabitsData() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['habits', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const habits = await supabase
        .from('habits')
        .select('id, name, icon, category, weekdays, reminder_time, created_at')
        .is('deleted_at', null)
        .is('archived_at', null)
        .order('created_at')
      if (habits.error) throw habits.error

      // O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas
      const logs: Log[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('habit_logs')
          .select('habit_id, log_date')
          .order('log_date')
          .order('habit_id')
          .range(from, from + 999)
        if (error) throw error
        logs.push(...((data ?? []) as Log[]))
        if (!data || data.length < 1000) break
      }
      // Ignora registros de hábitos excluídos
      const list = (habits.data ?? []) as Habit[]
      const ids = new Set(list.map((h) => h.id))
      return { habits: list, logs: logs.filter((l) => ids.has(l.habit_id)) }
    },
  })
}

export function useInvalidateHabits() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['habits'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'habits'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'water'] })
  }
}

// `done` = estado atual (true => desmarcar). O hábito de água também move a água do dia.
export async function toggleHabitLog(habitId: string, date: string, done: boolean) {
  const { data } = await supabase.from('habits').select('icon').eq('id', habitId).maybeSingle()
  if (data?.icon === 'water') return toggleWaterHabit(habitId, date, done)
  const { error } = done
    ? await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date)
    : await supabase.from('habit_logs').insert({ habit_id: habitId, log_date: date })
  if (error) throw error
}

export function useToggleLog() {
  const invalidate = useInvalidateHabits()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ habitId, date, done }: { habitId: string; date: string; done: boolean }) =>
      toggleHabitLog(habitId, date, done),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export interface NewHabit {
  name: string
  weekdays: number[]
  time: string
  category: string
}

export function useCreateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: async (h: NewHabit) => {
      const { error } = await supabase.from('habits').insert({
        name: h.name,
        icon: 'custom',
        weekdays: h.weekdays,
        reminder_time: `${h.time}:00`,
        category: h.category,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: async ({ id, ...h }: NewHabit & { id: string }) => {
      const { error } = await supabase
        .from('habits')
        .update({ name: h.name, weekdays: h.weekdays, reminder_time: `${h.time}:00`, category: h.category })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Exclusão "suave" (igual às tarefas): some das telas, mas o histórico não é apagado do banco
export function useDeleteHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('habits').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
