import { useState } from 'react'
import { Info, X } from 'lucide-react'
import { useSetMonthlyIncome } from '../../features/finance/queries'
import MoneyField from './MoneyField'
import styles from './finance.module.css'

interface Props {
  income: number
  savingsGoal: number | null
  onClose: () => void
}

export default function IncomeSheet({ income, savingsGoal, onClose }: Props) {
  const save = useSetMonthlyIncome()
  const [value, setValue] = useState(income)

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Renda mensal" onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <strong>Renda mensal</strong>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <p className={styles.sheetNote}><Info size={14} /> Valor líquido (depois dos descontos). É a base da sua sobra no mês, a mesma que aparece na Home.</p>
        <MoneyField value={value} onChange={setValue} label="Renda mensal" autoFocus className={styles.sheetMoney} />
        {save.isError && <p className={styles.error}>{save.error instanceof Error ? save.error.message : 'Não foi possível salvar'}</p>}
        <button
          type="button" className={styles.primary} disabled={value <= 0 || save.isPending}
          onClick={() => save.mutate({ income: value, previousIncome: income, savingsGoal }, { onSuccess: onClose })}
        >
          Salvar renda
        </button>
      </div>
    </div>
  )
}
