import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export type TaskCategory = 'work' | 'personal' | 'fitness' | 'mindset'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  notes: string | null
  due_at: string | null
  completed_at: string | null
  remind_minutes_before: number | null
  category: TaskCategory | null
  priority: TaskPriority
}

export interface TaskInput {
  title: string
  notes: string | null
  due_at: string
  category: TaskCategory
  priority: TaskPriority
  remind_minutes_before: number | null
}

const COLS = 'id, title, notes, due_at, completed_at, remind_minutes_before, category, priority'

// Pendentes (qualquer data) + concluídas hoje
export function useTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tasks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const [pending, done] = await Promise.all([
        supabase.from('tasks').select(COLS).is('completed_at', null).is('deleted_at', null)
          .order('due_at', { ascending: true, nullsFirst: false }),
        supabase.from('tasks').select(COLS).gte('completed_at', start.toISOString()).is('deleted_at', null)
          .order('completed_at', { ascending: false }),
      ])
      if (pending.error) throw pending.error
      if (done.error) throw done.error
      return { pending: (pending.data ?? []) as Task[], done: (done.data ?? []) as Task[] }
    },
  })
}

export function useTask(id?: string) {
  return useQuery({
    queryKey: ['tasks', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select(COLS).eq('id', id!).single()
      if (error) throw error
      return data as Task
    },
  })
}

function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'tasks'] })
    queryClient.invalidateQueries({ queryKey: ['calendar', 'schedule'] })
  }
}

export function useSaveTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TaskInput }) => {
      const { error } = id
        ? await supabase.from('tasks').update(input).eq('id', id)
        : await supabase.from('tasks').insert(input)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useToggleTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: done ? null : new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}