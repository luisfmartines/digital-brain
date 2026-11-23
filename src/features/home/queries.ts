import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { localDateStr } from '../../lib/date'

export function useTasksSummary() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'tasks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      const open = () => supabase.from('tasks').select('id', { count: 'exact', head: true }).is('completed_at', null).is('deleted_at', null)
      const [next, today, doneToday, dueNow] = await Promise.all([
        supabase.from('tasks').select('id, title, notes, due_at', { count: 'exact' }).is('completed_at', null).is('deleted_at', null)
          .order('due_at', { ascending: true, nullsFirst: false }).limit(1),
        open().gte('due_at', start.toISOString()).lte('due_at', end.toISOString()),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).gte('completed_at', start.toISOString()).is('deleted_at', null),
        open().lte('due_at', end.toISOString()),
      ])
      if (next.error) throw next.error
      return {
        next: (next.data?.[0] ?? null) as { id: string; title: string; notes: string | null; due_at: string | null } | null,
        pending: next.count ?? 0,
        today: today.count ?? 0,
        doneToday: doneToday.count ?? 0,
        dueNow: dueNow.count ?? 0,
      }
    },
  })
}

export function useTodayHabits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'habits', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = localDateStr()
      const dow = new Date().getDay()
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const [habits, logs] = await Promise.all([
        supabase.from('habits').select('id, name, weekdays').is('deleted_at', null).is('archived_at', null).order('created_at'),
        supabase.from('habit_logs').select('habit_id, log_date').gte('log_date', localDateStr(since)),
      ])
      if (habits.error) throw habits.error
      if (logs.error) throw logs.error
      const logRows = (logs.data ?? []) as { habit_id: string; log_date: string }[]
      const habitRows = (habits.data ?? []) as { id: string; name: string; weekdays: number[] | null }[]
      const doneToday = new Set(logRows.filter((l) => l.log_date === today).map((l) => l.habit_id))
      const days = new Set(logRows.map((l) => l.log_date))
      let streak = 0
      const d = new Date()
      if (!days.has(localDateStr(d))) d.setDate(d.getDate() - 1)
      while (days.has(localDateStr(d))) {
        streak++
        d.setDate(d.getDate() - 1)
      }
      return {
        streak,
        habits: habitRows.filter((h) => (h.weekdays ?? []).includes(dow)).map((h) => ({ id: h.id, name: h.name, done: doneToday.has(h.id) })),
      }
    },
  })
}

export function useToggleHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      const today = localDateStr()
      const { error } = done
        ? await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', today)
        : await supabase.from('habit_logs').insert({ habit_id: habitId, log_date: today })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', 'habits'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
    },
  })
}

export function useMonthFinance() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'finance', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const [settings, tx] = await Promise.all([
        supabase.from('user_settings').select('monthly_income').maybeSingle(),
        supabase.from('transactions').select('type, kind, amount').gte('occurred_on', localDateStr(first)).is('deleted_at', null),
      ])
      if (settings.error) throw settings.error
      if (tx.error) throw tx.error
      const income = Number(settings.data?.monthly_income ?? 0)
      let extra = 0
      let spent = 0
      for (const t of (tx.data ?? []) as { type: string; kind: string; amount: number }[]) {
        const amount = Number(t.amount)
        if (t.type === 'expense') spent += amount
        else if (t.kind !== 'salary') extra += amount
      }
      return { income, spent, margin: income + extra - spent }
    },
  })
}

export function useWater() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'water', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [logs, settings] = await Promise.all([
        supabase.from('water_logs').select('ml').eq('log_date', localDateStr()),
        supabase.from('user_settings').select('water_goal_ml').maybeSingle(),
      ])
      if (logs.error) throw logs.error
      const ml = ((logs.data ?? []) as { ml: number }[]).reduce((a, l) => a + l.ml, 0)
      return { ml, goal: Number(settings.data?.water_goal_ml ?? 2500) }
    },
  })
}

export function useAddWater() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ml: number) => {
      const { error } = await supabase.from('water_logs').insert({ log_date: localDateStr(), ml })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['home', 'water'] }),
  })
}

export function useWorkoutsToday() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'workouts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('workouts').select('id', { count: 'exact', head: true })
        .gte('ended_at', start.toISOString()).is('deleted_at', null)
      if (error) throw error
      return count ?? 0
    },
  })
}