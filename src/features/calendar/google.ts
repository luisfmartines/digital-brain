import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { localDateStr, parseDate } from '../../lib/date'
import { useAuth } from '../auth/useAuth'
import type { AgendaItem } from './agenda'
import type { EventInput } from './queries'
import { CALENDAR_REDIRECT, useDevice } from '../../expo/device'

export function useGoogleConnection() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('google_tokens').select('user_id, updated_at').eq('user_id', user!.id).maybeSingle()
      if (error) throw error
      return !!data?.user_id
    },
  })
}

export function useConnectGoogle() {
  const device = useDevice()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ url: string }>('google-calendar-connect',
        device ? { body: { client: 'native' } } : undefined)
      if (error || !data?.url || new URL(data.url).origin !== 'https://accounts.google.com') {
        throw new Error('Não foi possível abrir a conexão com o Google.')
      }
      if (device) await device.openAuth(data.url, CALENDAR_REDIRECT)
      else window.location.assign(data.url)
    },
  })
}

async function googleCalendar<T>(body: object) {
  const { data, error } = await supabase.functions.invoke<T>('google-calendar-create-event', { body })
  if (!error) return data
  const response = (error as { context?: Response }).context
  const details = await response?.json().catch(() => null)
  if (response?.status === 409 && details?.error === 'not_connected') return null
  if (details?.error === 'invalid_calendar') throw new Error('Esse calendário não está disponível para gravar. Escolha outro.')
  if (details?.error === 'reconnect_required') {
    throw new Error('Reconecte o Google Agenda em Perfil → Conexões e tente novamente.')
  }
  throw new Error('Não foi possível acessar o Google Agenda. Tente novamente.')
}

export async function createConnectedEvent(input: EventInput, calendarId?: string) {
  return googleCalendar<{ id: string }>({
    calendarId,
    title: input.title,
    description: input.description,
    category: input.category,
    start: input.all_day ? localDateStr(new Date(input.starts_at)) : input.starts_at,
    end: input.all_day && input.ends_at ? localDateStr(new Date(input.ends_at)) : input.ends_at,
    allDay: input.all_day,
    reminderMinutes: input.alarm_minutes_before,
  })
}

interface GoogleEvent {
  id: string
  htmlLink?: string
  summary?: string
  description?: string
  location?: string
  calendarName?: string
  calendarColor?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  extendedProperties?: { private?: { digitalBrainCategory?: string } }
}

function safeCalendarLink(value?: string) {
  try {
    const url = new URL(value ?? '')
    if (url.origin === 'https://calendar.google.com' || (url.origin === 'https://www.google.com' && url.pathname.startsWith('/calendar/'))) {
      return url.href
    }
  } catch { /* Google omits the link for some events. */ }
  return 'https://calendar.google.com/'
}

function toAgendaItem(event: GoogleEvent): AgendaItem[] {
  const start = event.start?.date ? parseDate(event.start.date) : new Date(event.start?.dateTime ?? '')
  const end = event.end?.date ? parseDate(event.end.date) : new Date(event.end?.dateTime ?? '')
  if (!Number.isFinite(start.getTime())) return []
  const category = event.extendedProperties?.private?.digitalBrainCategory
  return [{
    id: `google:${event.id}`,
    kind: 'google',
    href: safeCalendarLink(event.htmlLink),
    title: event.summary || 'Evento do Google Agenda',
    description: [event.description?.replace(/<[^>]*>/g, ' ').trim(), event.location].filter(Boolean).join('\n') || null,
    origin: event.calendarName,
    originColor: /^#[0-9a-f]{6}$/i.test(event.calendarColor ?? '') ? event.calendarColor : undefined,
    exportedFrom: /^(dbe|dbt)[0-9a-f]{32}$/.test(event.id) ? event.id : undefined,
    starts_at: start.toISOString(),
    ends_at: Number.isFinite(end.getTime()) ? end.toISOString() : null,
    all_day: !!event.start?.date,
    category: category === 'work' || category === 'meeting' || category === 'health' ? category : 'personal',
    alarm_minutes_before: null,
  }]
}

export function useGoogleEvents(from: Date, until: Date, connected: boolean) {
  const { user } = useAuth()
  const start = from.toISOString()
  const end = until.toISOString()
  return useQuery({
    queryKey: ['calendar', 'google', user?.id, start, end],
    enabled: !!user && connected,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const response = await googleCalendar<{ events: GoogleEvent[]; warnings?: string[] }>({
        action: 'list', start, end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      return { items: (response?.events ?? []).flatMap(toAgendaItem), warnings: response?.warnings ?? [] }
    },
  })
}

export interface GoogleCalendar {
  id: string
  name: string
  color?: string
  primary: boolean
  writable: boolean
}

export function useGoogleCalendars(connected: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['calendar', 'google-calendars', user?.id],
    enabled: connected && !!user,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await googleCalendar<{ calendars: GoogleCalendar[] }>({ action: 'calendars' })
      return data?.calendars ?? []
    },
  })
}

export function useSyncGoogleAgenda() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      let offset: number | null = 0
      let sent = 0
      let failed = 0
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      while (offset !== null) {
        const page: { sent: number; failed: number; next: number | null } | null =
          await googleCalendar({ action: 'sync', offset, timeZone })
        if (!page) throw new Error('Conecte o Google Agenda antes de sincronizar.')
        sent += page.sent
        failed += page.failed
        offset = page.next
      }
      return { sent, failed }
    },
    onSettled: () => cache.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
