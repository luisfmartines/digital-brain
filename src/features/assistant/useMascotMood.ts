import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { startOfDay } from '../../lib/date'
import { useTodayHabits } from '../home/queries'
import type { MascotMood } from '../../components/mascot/Mascot'

// ---- Regras do humor (ajuste aqui) ----
const ABANDONED_AFTER_DAYS = 3 // dias sem nenhuma atividade => abandonado
const SAD_AFTER_HOUR = 20 // depois dessa hora, hábito do dia pendente => triste
const CELEBRATE_MS = 4000 // quanto tempo comemora ao concluir um hábito

// Última atividade do usuário no app (hábito marcado, tarefa concluída ou treino finalizado)
function useLastActivity() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'habits', 'mascot-activity', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [log, task, workout] = await Promise.all([
        supabase.from('habit_logs').select('log_date').order('log_date', { ascending: false }).limit(1),
        supabase.from('tasks').select('completed_at').not('completed_at', 'is', null).is('deleted_at', null)
          .order('completed_at', { ascending: false }).limit(1),
        supabase.from('workouts').select('ended_at').not('ended_at', 'is', null).is('deleted_at', null)
          .order('ended_at', { ascending: false }).limit(1),
      ])
      const times: number[] = []
      const logDate = (log.data?.[0] as { log_date?: string } | undefined)?.log_date
      if (logDate) {
        const [y, m, d] = logDate.split('-').map(Number)
        times.push(new Date(y, m - 1, d).getTime())
      }
      const doneAt = (task.data?.[0] as { completed_at?: string } | undefined)?.completed_at
      if (doneAt) times.push(new Date(doneAt).getTime())
      const endedAt = (workout.data?.[0] as { ended_at?: string } | undefined)?.ended_at
      if (endedAt) times.push(new Date(endedAt).getTime())
      return { last: times.length ? Math.max(...times) : null }
    },
  })
}

function useOverdueTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['home', 'tasks', 'mascot-overdue', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tasks').select('id', { count: 'exact', head: true })
        .is('completed_at', null).is('deleted_at', null)
        .lt('due_at', new Date().toISOString())
      if (error) throw error
      return count ?? 0
    },
  })
}

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

export function useMascotMood(): { mood: MascotMood; celebrating: boolean } {
  const today = useTodayHabits().data
  const activity = useLastActivity().data
  const overdue = useOverdueTasks().data ?? 0
  const now = useNow()

  const loaded = today !== undefined
  const total = today?.habits.length ?? 0
  const done = today?.habits.filter((h) => h.done).length ?? 0

  // Comemora quando o número de hábitos feitos hoje aumenta (não na primeira carga)
  const [prevDone, setPrevDone] = useState<number | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  if (loaded && done !== prevDone) {
    setPrevDone(done)
    if (prevDone !== null && done > prevDone) setCelebrating(true)
  }
  useEffect(() => {
    if (!celebrating) return
    const t = window.setTimeout(() => setCelebrating(false), CELEBRATE_MS)
    return () => window.clearTimeout(t)
  }, [celebrating])

  if (!loaded) return { mood: 'neutro', celebrating: false }

  const idleDays =
    activity?.last == null
      ? 0
      : Math.round((startOfDay(new Date(now)).getTime() - startOfDay(new Date(activity.last)).getTime()) / 86_400_000)

  // Prioridade: abandonado > feliz > triste > neutro
  if (idleDays >= ABANDONED_AFTER_DAYS) return { mood: 'abandonado', celebrating: false }
  if (celebrating || (total > 0 && done === total)) return { mood: 'feliz', celebrating }
  const evening = new Date(now).getHours() >= SAD_AFTER_HOUR
  if (overdue > 0 || (total > 0 && evening)) return { mood: 'triste', celebrating: false }
  return { mood: 'neutro', celebrating: false }
}
