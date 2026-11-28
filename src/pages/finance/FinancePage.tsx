import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, CirclePlus, Repeat, Sparkles } from 'lucide-react'
import ActionSheet from '../../components/ui/ActionSheet'
import Dialog from '../../components/ui/Dialog'
import FloatingAction from '../../components/ui/FloatingAction'
import { useOnline } from '../../hooks/useOnline'
import { useFinanceMonth } from '../../features/finance/queries'
import {
  buildInsight, buildSummary, dailyPace, monthElapsed, monthKey, monthLabel, recentMonths,
} from '../../features/finance/summary'
import { Breakdown, Hero, Composition } from './parts'
import QuickAdd from './QuickAdd'
import TransactionList from './TransactionList'
import IncomeSheet from './IncomeSheet'
import RecurringTransactions, { RecurringForm } from './RecurringTransactions'
import styles from './finance.module.css'

export default function FinancePage() {
  const online = useOnline()
  const [month, setMonth] = useState(() => monthKey())
  const [menu, setMenu] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [action, setAction] = useState<'menu' | 'once' | 'recurring' | null>(null)
  const { data, isPending, error, refetch } = useFinanceMonth(month)

  const current = month === monthKey()
  const summary = useMemo(() => (data ? buildSummary(data.income, data.rows) : null), [data])
  const months = useMemo(() => recentMonths(12), [])

  let body
  if (isPending) {
    body = <p className={styles.empty}>Carregando suas finanças…</p>
  } else if (error || !data || !summary) {
    body = (
      <div className={`${styles.card} ${styles.errorCard}`}>
        <strong>Não foi possível carregar as finanças</strong>
        <p>{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
        <button type="button" className={styles.primary} onClick={() => refetch()}>Tentar de novo</button>
      </div>
    )
  } else {
    const over = summary.margin < 0
    const onTrack = !over && (!current || summary.base === 0 || summary.spent / summary.base <= monthElapsed(month) + 0.05)
    const chip = over ? 'Estourado' : `${summary.freePct}% Livre / ${onTrack ? 'Seguro' : 'Atenção'}`
    const insight = buildInsight({ summary, savingsGoal: data.savingsGoal, month })

    body = (
      <>
        {data.income <= 0 && (
          <button type="button" className={`${styles.card} ${styles.setup}`} onClick={() => setIncomeOpen(true)}>
            <strong>Defina sua renda mensal</strong>
            <span>Sem ela não dá para calcular sua sobra. Toque para informar.</span>
          </button>
        )}
        <Hero
          summary={summary}
          label={current ? 'SOBRA ESTIMADA DO MÊS' : 'SOBRA DO MÊS'}
          chip={chip}
          pace={dailyPace(summary.margin, month)}
        />
        <Breakdown summary={summary} onEditIncome={() => setIncomeOpen(true)} />
        <Composition summary={summary} />
        <RecurringTransactions />
        {insight && (
          <section className={`${styles.card} ${styles.insight}`}>
            <span className={styles.iconBox}><Sparkles size={18} /></span>
            <div>
              <strong>Insight da Synapse <i /></strong>
              <p>{insight}</p>
            </div>
          </section>
        )}
        <TransactionList rows={data.rows} />
        {incomeOpen && <IncomeSheet income={data.income} savingsGoal={data.savingsGoal} onClose={() => setIncomeOpen(false)} />}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div className={styles.monthWrap}>
          <button type="button" className={styles.monthPill} onClick={() => setMenu((o) => !o)} aria-haspopup="listbox" aria-expanded={menu}>
            <CalendarDays size={15} /> {monthLabel(month)} <ChevronDown size={14} />
          </button>
          {menu && (
            <>
              <div className={styles.menuBackdrop} onClick={() => setMenu(false)} role="presentation" />
              <ul className={styles.menu} role="listbox" aria-label="Mês">
                {months.map((m) => (
                  <li key={m}>
                    <button type="button" role="option" aria-selected={m === month} className={m === month ? styles.menuOn : undefined} onClick={() => { setMonth(m); setMenu(false) }}>
                      {monthLabel(m)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <span className={styles.sync}><i className={online ? styles.dot : styles.dotOff} /> {online ? 'Sync Ativo' : 'Offline'}</span>
      </div>

      <div>
        <h1 className={styles.title}>Finanças &amp; Orçamento</h1>
        <p className={styles.sub}>Controle de capital e margem livre</p>
      </div>

      {body}
      <FloatingAction label="Adicionar em Finanças" onClick={() => setAction('menu')} />
      {action === 'menu' && <ActionSheet title="Adicionar em Finanças" onClose={() => setAction(null)}>
        <button type="button" onClick={() => setAction('once')}><CirclePlus size={21} /><span><strong>Novo lançamento</strong><small>Registre uma despesa ou uma receita.</small></span></button>
        <button type="button" onClick={() => setAction('recurring')}><Repeat size={21} /><span><strong>Nova recorrência</strong><small>Adicione uma assinatura ou outro valor que se repete.</small></span></button>
      </ActionSheet>}
      {action === 'once' && <Dialog title="Novo lançamento" onClose={() => setAction(null)}>
        <QuickAdd onAdded={() => { setMonth(monthKey()); setAction(null) }} />
      </Dialog>}
      {action === 'recurring' && <RecurringForm onClose={() => setAction(null)} />}
    </div>
  )
}
