import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { localDateStr } from '../../lib/date'
import { monthRange, type TxRow } from './summary'

const COLS = 'id, type, kind, amount, occurred_on, title:description, category, source, is_recurring, created_at'

export async function syncRecurringFinance() {
  const { error } = await supabase.rpc('sync_finance_recurring')
  if (error) throw error
}

export function useFinanceMonth(month: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['finance', 'month', user?.id, month],
    enabled: !!user,
    queryFn: async () => {
      const { from, to } = monthRange(month)
      await syncRecurringFinance()
      const [settings, tx] = await Promise.all([
        supabase.from('user_settings').select('monthly_income, savings_goal').maybeSingle(),
        supabase.from('transactions').select(COLS)
          .gte('occurred_on', from).lt('occurred_on', to).is('deleted_at', null)
          .order('occurred_on', { ascending: false }).order('created_at', { ascending: false }),
      ])
      if (settings.error) throw settings.error
      if (tx.error) throw tx.error
      const rows: TxRow[] = (tx.data ?? []).map((r) => ({ ...r, type: r.type as TxRow['type'], method: null, source: r.is_recurring ? 'recurring' : r.source, amount: Number(r.amount) }))
      const goal = settings.data?.savings_goal
      return {
        income: Number(settings.data?.monthly_income ?? 0),
        savingsGoal: goal == null ? null : Number(goal),
        rows,
      }
    },
  })
}

// Home e Finanças precisam atualizar juntas
function useInvalidateFinance() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['finance'] })
    queryClient.invalidateQueries({ queryKey: ['home', 'finance'] })
  }
}

export interface NewTransaction {
  type: 'expense' | 'income'
  amount: number
  title: string
  category: string
  group?: string // expenses: salva em `kind` o grupo (fixed/variable/leisure)
}

function transactionKind(type: NewTransaction['type'], group?: string) {
  return type === 'income' ? 'extra' : group === 'fixed' || group === 'leisure' ? group : 'other'
}

export type Frequency = 'weekly' | 'monthly' | 'yearly'
export interface RecurringTransaction {
  id: string
  type: NewTransaction['type']
  description: string
  amount: number
  starts_on: string
  frequency: Frequency
}

export function useRecurringTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['finance', 'recurring', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('finance_recurring')
        .select('id,type,description,amount,starts_on,frequency')
        .eq('user_id', user!.id).is('cancelled_on', null).order('starts_on')
      if (error) throw error
      return (data ?? []) as RecurringTransaction[]
    },
  })
}

export function useAddRecurring() {
  const { user } = useAuth()
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (rule: NewTransaction & { id: string; startsOn: string; frequency: Frequency }) => {
      if (!user) throw new Error('Entre novamente para criar uma recorrência.')
      const { error } = await supabase.from('finance_recurring').upsert({
        id: rule.id, user_id: user.id, type: rule.type, kind: transactionKind(rule.type, rule.group),
        amount: rule.amount, description: rule.title.trim(), category: rule.category,
        starts_on: rule.startsOn, frequency: rule.frequency,
      }, { ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useCancelRecurring() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_finance_recurring', { rule_id: id })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useAddTransaction() {
  const { user } = useAuth()
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (t: NewTransaction) => {
      if (!user) throw new Error('Entre novamente para registrar um lançamento.')
      if (!Number.isFinite(t.amount) || t.amount <= 0) throw new Error('Informe um valor maior que zero.')
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: t.type,
        kind: transactionKind(t.type, t.group),
        amount: t.amount,
        occurred_on: localDateStr(),
        description: t.title.trim() || null,
        category: t.category,
        source: 'app',
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Exclusão "suave" (igual às tarefas e hábitos)
export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

// Muda a renda mensal; a meta de economia (em R$) acompanha na mesma proporção
export function useSetMonthlyIncome() {
  const { user } = useAuth()
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: async ({ income, previousIncome, savingsGoal }: { income: number; previousIncome: number; savingsGoal: number | null }) => {
      const payload: Record<string, unknown> = { user_id: user!.id, monthly_income: income }
      if (savingsGoal != null && previousIncome > 0) payload.savings_goal = Math.round((savingsGoal / previousIncome) * income * 100) / 100
      const { error } = await supabase.from('user_settings').upsert(payload)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
