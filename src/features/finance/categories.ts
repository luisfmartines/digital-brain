import {
  Banknote, Car, CircleEllipsis, Gamepad2, HeartPulse, House, Landmark, Repeat, ShoppingCart, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react'

// Os três grupos que aparecem nos cards e no gráfico de composição
export type Group = 'fixed' | 'variable' | 'leisure'

export interface Category {
  id: string
  label: string
  group: Group
  icon: LucideIcon
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', label: 'Alimentação', group: 'variable', icon: Utensils },
  { id: 'groceries', label: 'Mercado', group: 'variable', icon: ShoppingCart },
  { id: 'transport', label: 'Transporte', group: 'variable', icon: Car },
  { id: 'leisure', label: 'Lazer', group: 'leisure', icon: Gamepad2 },
  { id: 'subscriptions', label: 'Assinaturas', group: 'leisure', icon: Repeat },
  { id: 'housing', label: 'Moradia', group: 'fixed', icon: House },
  { id: 'bills', label: 'Contas', group: 'fixed', icon: Zap },
  { id: 'health', label: 'Saúde', group: 'variable', icon: HeartPulse },
  { id: 'other', label: 'Outros', group: 'variable', icon: CircleEllipsis },
]

export const INCOME_CATEGORY: Category = { id: 'income', label: 'Entrada', group: 'variable', icon: Landmark }
export const SALARY_ICON = Banknote

// Lançamentos antigos (sem categoria) caem em "Outros"
export const categoryOf = (id: string | null | undefined): Category =>
  EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

export const GROUPS: Record<Group, { label: string; hint: string; color: string }> = {
  fixed: { label: 'Despesas Fixas', hint: 'Aluguel, contas, luz', color: '#1f5a3f' },
  variable: { label: 'Variáveis / Rotina', hint: 'Mercado, farmácia', color: '#3a8f64' },
  leisure: { label: 'Lazer & Apps', hint: 'Jantares, streaming', color: '#8a9a92' },
}
export const FREE_COLOR = '#6fcf9a'
