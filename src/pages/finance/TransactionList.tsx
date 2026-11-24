import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { INCOME_CATEGORY, SALARY_ICON, categoryOf } from '../../features/finance/categories'
import { useDeleteTransaction } from '../../features/finance/queries'
import { MONTHS_SHORT, type TxRow } from '../../features/finance/summary'
import { localDateStr } from '../../lib/date'
import { formatBRL } from '../../features/onboarding/utils'
import styles from './finance.module.css'

const PREVIEW = 5

function whenLabel(r: TxRow, withTime = true) {
  const time = r.created_at && withTime
    ? new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (r.occurred_on === localDateStr(today)) return time ? `Hoje, ${time}` : 'Hoje'
  if (r.occurred_on === localDateStr(yesterday)) return time ? `Ontem, ${time}` : 'Ontem'
  const [, m, d] = r.occurred_on.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

function tagOf(r: TxRow): { text: string; good: boolean } | null {
  if (r.type === 'income') return { text: r.kind === 'salary' ? 'Salário' : 'Receita Extra', good: true }
  if (r.source === 'ai' || r.source === 'chatbot') return { text: r.method ? `IA Chat / ${r.method}` : 'IA Chat', good: true }
  if (r.source === 'recurring') return { text: 'Recorrência', good: true }
  if (r.method) return { text: r.method, good: false }
  return null
}

const cat = (r: TxRow) => (r.type === 'income' ? INCOME_CATEGORY : categoryOf(r.category))
const money = (r: TxRow) => `${r.type === 'income' ? '+' : '-'}${formatBRL(Math.abs(r.amount))}`

export default function TransactionList({ rows }: { rows: TxRow[] }) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<TxRow | null>(null)
  const shown = all ? rows : rows.slice(0, PREVIEW)

  return (
    <section className={styles.txSection}>
      <div className={styles.sectionHead}>
        <h2>Transações Recentes</h2>
        {rows.length > PREVIEW && (
          <button type="button" className={styles.linkBtn} onClick={() => setAll((v) => !v)}>{all ? 'Ver menos' : 'Ver todas'}</button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Nenhum lançamento neste mês. Use o Lançamento Rápido acima.</p>
      ) : (
        <ul className={styles.txList}>
          {shown.map((r) => {
            const c = cat(r)
            const Icon = r.type === 'income' && r.kind === 'salary' ? SALARY_ICON : c.icon
            const tag = tagOf(r)
            return (
              <li key={r.id}>
                <button type="button" className={`${styles.tx} ${r.type === 'income' && r.kind !== 'salary' ? styles.txIncome : ''}`} onClick={() => setOpen(r)}>
                  <span className={styles.txIcon}><Icon size={20} /></span>
                  <span className={styles.txBody}>
                    <strong>{r.title || c.label}</strong>
                    <small>
                      {whenLabel(r)}
                      {tag && <em className={tag.good ? styles.tagGood : styles.tag}>{tag.text}</em>}
                    </small>
                  </span>
                  <span className={styles.txAmount}>
                    <b className={r.type === 'income' ? styles.pos : ''}>{money(r)}</b>
                    <small>{c.label}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && <TransactionSheet row={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function TransactionSheet({ row, onClose }: { row: TxRow; onClose: () => void }) {
  const remove = useDeleteTransaction()
  const [confirm, setConfirm] = useState(false)
  const c = cat(row)
  const tag = tagOf(row)

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Detalhes do lançamento" onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <strong>{row.title || c.label}</strong>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <dl className={styles.details}>
          <div><dt>Valor</dt><dd className={row.type === 'income' ? styles.pos : ''}>{money(row)}</dd></div>
          <div><dt>Categoria</dt><dd>{c.label}</dd></div>
          <div><dt>Data</dt><dd>{whenLabel(row)}</dd></div>
          {tag && <div><dt>Origem</dt><dd>{tag.text}</dd></div>}
        </dl>
        {remove.isError && <p className={styles.error}>Não foi possível excluir. Tente de novo.</p>}
        {confirm ? (
          <div className={styles.confirmRow}>
            <button type="button" className={styles.ghostBtn} onClick={() => setConfirm(false)}>Manter</button>
            <button type="button" className={styles.dangerBtn} disabled={remove.isPending} onClick={() => remove.mutate(row.id, { onSuccess: onClose })}>
              <Trash2 size={14} /> Sim, excluir
            </button>
          </div>
        ) : (
          <button type="button" className={styles.dangerLink} onClick={() => setConfirm(true)}><Trash2 size={14} /> Excluir lançamento</button>
        )}
      </div>
    </div>
  )
}
