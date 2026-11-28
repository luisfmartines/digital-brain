import { useState, type FormEvent } from 'react'
import { Repeat } from 'lucide-react'
import Dialog from '../../components/ui/Dialog'
import { useConfirmation } from '../../components/ui/useConfirmation'
import { localDateStr, parseDate } from '../../lib/date'
import { categoryOf, EXPENSE_CATEGORIES } from '../../features/finance/categories'
import { useAddRecurring, useCancelRecurring, useRecurringTransactions, type Frequency } from '../../features/finance/queries'
import MoneyField from './MoneyField'
import styles from './finance.module.css'

const FREQUENCIES: Record<Frequency, string> = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function RecurringForm({ onClose }: { onClose: () => void }) {
  const save = useAddRecurring()
  const [id] = useState(() => crypto.randomUUID())
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('subscriptions')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startsOn, setStartsOn] = useState(localDateStr())
  const valid = !!title.trim() && amount > 0 && !!startsOn

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || save.isPending) return
    save.mutate({
      id, type: category === 'income' ? 'income' : 'expense', title, amount, category,
      group: category === 'income' ? undefined : categoryOf(category).group, frequency, startsOn,
    }, { onSuccess: onClose })
  }

  return <Dialog title="Nova recorrência" onClose={onClose} busy={save.isPending}>
    <form onSubmit={submit} className={styles.recurringForm}>
      <label>Descrição<input required maxLength={60} value={title} placeholder="Ex.: Assinatura de música" onChange={(event) => setTitle(event.target.value)} /></label>
      <MoneyField label="Valor da recorrência" value={amount} onChange={setAmount} />
      <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>
        {EXPENSE_CATEGORIES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        <option value="income">Receita</option>
      </select></label>
      <div className={styles.recurringFields}>
        <label>Frequência<select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
          {Object.entries(FREQUENCIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Primeiro lançamento<input required type="date" min={localDateStr()} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
      </div>
      {save.isError && <p className={styles.error} role="alert">Não foi possível salvar a recorrência. Confira os dados e tente novamente.</p>}
      <button className={styles.primary} type="submit" disabled={save.isPending || !valid}>{save.isPending ? 'Salvando…' : 'Salvar recorrência'}</button>
    </form>
  </Dialog>
}

export default function RecurringTransactions() {
  const query = useRecurringTransactions()
  const cancel = useCancelRecurring()
  const confirmation = useConfirmation()
  if (query.isError) return <p className={styles.error} role="alert">Não foi possível carregar as recorrências. <button type="button" onClick={() => query.refetch()}>Tentar novamente</button></p>
  if (!query.data?.length) return null
  return <section className={styles.card}>
    <div className={styles.sectionHead}><h2><Repeat size={18} /> Recorrências</h2></div>
    <ul className={styles.recurringList}>
      {query.data.map((rule) => <li key={rule.id}>
        <div><strong>{rule.description}</strong><small>{FREQUENCIES[rule.frequency]} · início em {parseDate(rule.starts_on).toLocaleDateString('pt-BR')}</small></div>
        <strong>{rule.type === 'expense' ? '−' : '+'}{currency.format(Number(rule.amount))}</strong>
        <button type="button" className={styles.chip} disabled={cancel.isPending}
          aria-label={'Cancelar recorrência de ' + rule.description}
          onClick={() => confirmation.ask({
            title: 'Cancelar recorrência?', description: 'Os lançamentos anteriores ficam no histórico.',
            confirmLabel: 'Cancelar recorrência', danger: true, onConfirm: () => cancel.mutate(rule.id),
          })}>Cancelar</button>
      </li>)}
    </ul>
    {cancel.isError && <p role="alert" className={styles.error}>Não foi possível cancelar a recorrência.</p>}
    {confirmation.dialog}
  </section>
}
