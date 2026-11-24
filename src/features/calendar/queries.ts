import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export const EVENT_CATEGORIES = {
  work: 'Trabalho',
  meeting: 'Reunião',
  health: 'Saúde',
  personal: 'Pessoal',
} as const

export interface EventInput {
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  alarm_minutes_before: number | null
  category: keyof typeof EVENT_CATEGORIES
}

export interface CalendarEvent extends EventInput {
  id: string
}

const COLUMNS = 'id, title, description, starts_at, ends_at, all_day, alarm_minutes_before, category'

export function useCalendarEvents(from: Date, until: Date) {
  const { user } = useAuth()
  const start = from.toISOString()
  const end = until.toISOString()

  return useQuery({
    queryKey: ['calendar', user?.id, start, end],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select(COLUMNS)
        .is('deleted_at', null).lt('starts_at', end)
        .or(`starts_at.gte.${start},ends_at.gt.${start}`)
        .order('starts_at').order('id')
      if (error) throw error
      return data as CalendarEvent[]
    },
  })
}

export function useCalendarEvent(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['calendar', user?.id, 'event', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select(COLUMNS)
        .eq('id', id!).is('deleted_at', null).single()
      if (error) throw error
      return data as CalendarEvent
    },
  })
}

export function useChangeEvent() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (change: { id?: string; input: EventInput } | { id: string; remove: true }) => {
      const events = supabase.from('calendar_events')
      const { error } = 'remove' in change
        ? await events.update({ deleted_at: new Date().toISOString() }).eq('id', change.id).is('deleted_at', null).select('id').single()
        : change.id
          ? await events.update(change.input).eq('id', change.id).is('deleted_at', null).select('id').single()
          : await events.insert({ ...change.input, source: 'app' })
      if (error) throw error
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
