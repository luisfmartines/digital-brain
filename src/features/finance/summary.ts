import { categoryOf, type Group } from './categories'
import { formatBRL } from '../onboarding/utils'

export interface TxRow {
  id: string
  type: 'expense' | 'income'
  kind: string | null
  amount: number
  occurred_on: string // YYYY-MM-DD
  title: string | null
  category: string | null
  method: string | null
  source: string | null
  created_at: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const round2 = (n: number) => Math.round(n * 100) / 100

// ---------- meses ("YYYY-MM") ----------
export const monthKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function parseKey(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month0: m - 1 }
}

export function monthLabel(key: string) {
  const { year, month0 } = parseKey(key)
  return `${MONTHS[month0]} ${year}`
}

// `from` inclusivo, `to` exclusivo (1º dia do mês seguinte)
export function monthRange(key: string) {
  const { year, month0 } = parseKey(key)
  const next = new Date(year, month0 + 1, 1)
  return { from: `${year}-${pad(month0 + 1)}-01`, to: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01` }
}

export function recentMonths(count = 12, now: Date = new Date()) {
  return Array.from({ length: count }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
}

// ---------- a conta da sobra: UMA fonte de verdade (Home e Finanças usam esta função) ----------
// sobra = renda mensal + receitas extras − gastos.
// Entradas do tipo "salary" não somam: o salário já está na renda mensal (user_settings).
export function totals(income: number, rows: Pick<TxRow, 'type' | 'kind' | 'amount'>[]) {
  let extra = 0
  let spent = 0
  for (const t of rows) {
    const amount = Number(t.amount)
    if (t.type === 'expense') spent += amount
    else if (t.kind !== 'salary') extra += amount
  }
  extra = round2(extra)
  spent = round2(spent)
  return { extra, spent, margin: round2(income + extra - spent) }
}

// Margem dividida pelos dias que faltam no mês (contando hoje). Só faz sentido no mês atual.
export function dailyPace(margin: number, key: string, now: Date = new Date()) {
  if (key !== monthKey(now)) return null
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const remaining = daysInMonth - now.getDate() + 1
  return Math.max(0, margin) / remaining
}

export function monthElapsed(key: string, now: Date = new Date()) {
  if (key !== monthKey(now)) return 1
  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

export function buildSummary(income: number, rows: TxRow[]) {
  const { extra, spent, margin } = totals(income, rows)
  const base = round2(income + extra)

  const groups: Record<Group, number> = { fixed: 0, variable: 0, leisure: 0 }
  const byCategory = new Map<string, number>()
  for (const t of rows) {
    if (t.type !== 'expense') continue
    const cat = categoryOf(t.category)
    groups[cat.group] = round2(groups[cat.group] + Number(t.amount))
    byCategory.set(cat.id, round2((byCategory.get(cat.id) ?? 0) + Number(t.amount)))
  }

  const spentPct = base > 0 ? Math.min(100, Math.max(0, Math.round((spent / base) * 100))) : 0
  const freePct = margin > 0 && base > 0 ? 100 - spentPct : 0
  const pctOfBase = (n: number) => (base > 0 ? (n / base) * 100 : 0)

  return { income, extra, spent, margin, base, groups, byCategory, spentPct, freePct, pctOfBase }
}
export type Summary = ReturnType<typeof buildSummary>

// ---------- insight (regras simples, sem IA) ----------
interface InsightInput {
  summary: Summary
  savingsGoal: number | null
  month: string
  now?: Date
}

export function buildInsight({ summary: s, savingsGoal, month, now = new Date() }: InsightInput): string | null {
  if (s.base <= 0) return null
  const current = month === monthKey(now)

  if (s.margin < 0) {
    return `Seus gastos ${current ? 'já passam' : 'passaram'} da renda em ${formatBRL(-s.margin)}${current ? '. Vale revisar os lançamentos variáveis e de lazer deste mês.' : ' neste mês.'}`
  }

  if (current && now.getDate() >= 5) {
    const elapsed = monthElapsed(month, now)
    const used = s.spent / s.base
    if (used > elapsed + 0.05) {
      return `Você já usou ${Math.round(used * 100)}% da renda com ${Math.round(elapsed * 100)}% do mês. Nesse ritmo, os gastos fecham o mês em cerca de ${formatBRL(s.spent / elapsed)}.`
    }
  }

  if (savingsGoal && savingsGoal > 0) {
    if (s.margin >= savingsGoal) {
      return `${current ? 'Sua sobra de' : 'A sobra de'} ${formatBRL(s.margin)} ${current ? 'já cobre' : 'cobriu'} a meta de economia de ${formatBRL(savingsGoal)}, com ${formatBRL(s.margin - savingsGoal)} além dela.`
    }
    return `${current ? 'Faltam' : 'Faltaram'} ${formatBRL(savingsGoal - s.margin)} de sobra para atingir a meta de economia de ${formatBRL(savingsGoal)}.`
  }

  let top: [string, number] | null = null
  for (const e of s.byCategory) if (!top || e[1] > top[1]) top = e
  if (top) return `Sua maior categoria de gasto é ${categoryOf(top[0]).label} (${formatBRL(top[1])}), ${Math.round(s.pctOfBase(top[1]))}% da renda.`

  return 'Registre seus gastos no Lançamento Rápido para a Synapse acompanhar sua margem e seu ritmo diário.'
}
