import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { reconcileWaterHabit } from '../water/queries'

export interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

export type Undo =
  | { table: 'transactions' | 'calendar_events' | 'tasks' | 'workout_routines'; id: string }
  | { table: 'habit_logs'; habit_id: string; log_date: string }
  | { table: 'water_logs'; id: string; log_date: string }

export interface NeuralAction {
  kind: 'transaction' | 'event' | 'task' | 'habit' | 'water' | 'routine'
  title: string
  subtitle?: string
  amount?: string
  badge?: string
  link?: string
  undo?: Undo
}

export interface NeuralReply {
  reply: string
  actions: NeuralAction[]
}

// Manda a conversa (só as últimas mensagens, sem histórico salvo) para a Edge Function "neural"
export async function askNeural(messages: ChatMsg[]): Promise<NeuralReply> {
  const { data, error } = await supabase.functions.invoke('neural', {
    body: { messages: messages.slice(-10), tzOffsetMinutes: new Date().getTimezoneOffset() },
  })
  if (error) {
    let msg = 'Não consegui falar com o Neural agora. Tente de novo.'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) msg = body.error
    } catch {
      /* resposta sem JSON: usa a mensagem padrão */
    }
    throw new Error(msg)
  }
  return data as NeuralReply
}

// Atualiza as telas que mostram dados (o app usa cache do React Query)
export function refreshAppData(qc: QueryClient) {
  for (const key of ['home', 'tasks', 'habits', 'workouts', 'finance', 'calendar', 'routine']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}

// Desfaz uma ação do Neural (apaga/arquiva o que ele criou)
export async function undoAction(u: Undo) {
  if (u.table === 'habit_logs') {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', u.habit_id).eq('log_date', u.log_date)
    if (error) throw error
    return
  }
  if (u.table === 'water_logs') {
    const { error } = await supabase.from('water_logs').delete().eq('id', u.id)
    if (error) throw error
    await reconcileWaterHabit(u.log_date)
    return
  }
  const { error } = await supabase.from(u.table).update({ deleted_at: new Date().toISOString() }).eq('id', u.id)
  if (error) throw error
}
