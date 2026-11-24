import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, CirclePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EXPENSE_CATEGORIES, categoryOf } from '../../features/finance/categories'
import { useAddTransaction } from '../../features/finance/queries'
import MoneyField from './MoneyField'
import styles from './finance.module.css'

const INCOME = 'income'

export default function QuickAdd({ onAdded }: { onAdded: () => void }) {
  const navigate = useNavigate()
  const add = useAddTransaction()
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].id)
  const [amount, setAmount] = useState(0)
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 1600)
    return () => window.clearTimeout(t)
  }, [saved])

  const isIncome = category === INCOME

  function submit(e: FormEvent) {
    e.preventDefault()
    if (amount <= 0 || add.isPending) return
    add.mutate(
      {
        type: isIncome ? 'income' : 'expense',
        amount,
        title,
        category,
        group: isIncome ? undefined : categoryOf(category).group,
      },
      {
        onSuccess: () => {
          setAmount(0)
          setTitle('')
          setSaved(true)
          onAdded()
        },
      },
    )
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <div className={styles.sectionHead}>
        <h2><CirclePlus size={18} /> Lançamento Rápido</h2>
        <button type="button" className={styles.aiChip} onClick={() => navigate('/assistant', { state: { prompt: title.trim() || undefined } })}>
          IA Synapse
        </button>
      </div>

      <div className={styles.chips} role="radiogroup" aria-label="Categoria">
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={category === c.id} className={category === c.id ? styles.chipOn : styles.chip} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={isIncome} className={isIncome ? styles.chipOn : styles.chip} onClick={() => setCategory(INCOME)}>
          + Receita
        </button>
      </div>

      <div className={styles.addRow}>
        <MoneyField value={amount} onChange={setAmount} label="Valor" className={styles.addMoney} />
        <input
          className={styles.addText} value={title} maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isIncome ? 'ex: Freelance' : 'ex: Almoço'} aria-label="Descrição"
        />
        <button type="submit" className={styles.saveBtn} disabled={amount <= 0 || add.isPending}>
          {saved ? <>Salvo <Check size={15} /></> : <>Salvar <ArrowRight size={15} /></>}
        </button>
      </div>
      {add.isError && <p className={styles.error}>{add.error instanceof Error ? add.error.message : 'Não foi possível salvar'}</p>}
    </form>
  )
}
