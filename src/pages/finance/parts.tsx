import { Gauge, PieChart, Pencil, Wallet, House, ShoppingCart, Gamepad2, Banknote } from 'lucide-react'
import { FREE_COLOR, GROUPS, type Group } from '../../features/finance/categories'
import { brl0, pct1 } from '../../features/finance/format'
import { formatBRL } from '../../features/onboarding/utils'
import type { Summary } from '../../features/finance/summary'
import Amount from './Amount'
import styles from './finance.module.css'

interface HeroProps {
  summary: Summary
  label: string
  chip: string
  pace: number | null
}

export function Hero({ summary: s, label, chip, pace }: HeroProps) {
  const over = s.margin < 0
  return (
    <section className={`${styles.card} ${styles.hero}`}>
      <div className={styles.heroTop}>
        <div>
          <span className={styles.cap}>{label}</span>
          <div className={`${styles.bigLine} ${over ? styles.negative : ''}`}><Amount value={s.margin} size="lg" /></div>
        </div>
        <span className={`${styles.freeChip} ${over ? styles.freeChipBad : ''}`}><Wallet size={14} /> {chip}</span>
      </div>

      <div className={styles.split} role="img" aria-label={`Gastos ${s.spentPct}%, livre ${s.freePct}%`}>
        <i className={styles.splitSpent} style={{ width: `${s.spentPct}%` }} />
        <i className={styles.splitFree} style={{ width: `${s.freePct}%` }} />
      </div>
      <div className={styles.splitLegend}>
        <span><i style={{ background: GROUPS.fixed.color }} /> Gastos: <b>{formatBRL(s.spent)}</b> ({s.spentPct}%)</span>
        <span><i style={{ background: FREE_COLOR }} /> Livre: <b>{formatBRL(Math.max(0, s.margin))}</b> ({s.freePct}%)</span>
      </div>

      {pace !== null && (
        <div className={styles.paceRow}>
          <span><Gauge size={16} /> Ritmo diário seguro:</span>
          <strong>{brl0(pace)} <small>/ dia</small></strong>
        </div>
      )}
    </section>
  )
}

const GROUP_ICON = { fixed: House, variable: ShoppingCart, leisure: Gamepad2 } as const

export function Breakdown({ summary: s, onEditIncome }: { summary: Summary; onEditIncome: () => void }) {
  return (
    <div className={styles.grid2}>
      <button type="button" className={`${styles.card} ${styles.mini} ${styles.miniBtn}`} onClick={onEditIncome} aria-label="Editar renda mensal">
        <div className={styles.miniTop}>
          <span className={styles.iconBox}><Banknote size={18} /></span>
          <span className={styles.badgeGood}>Entrada</span>
        </div>
        <span className={styles.miniLabel}>Salário Mensal <Pencil size={11} /></span>
        <Amount value={s.income} />
        <span className={styles.miniSubGood}>{s.extra > 0 ? `+ ${formatBRL(s.extra)} em extras` : '100% Base Líquida'}</span>
      </button>

      {(Object.keys(GROUPS) as Group[]).map((g) => {
        const Icon = GROUP_ICON[g]
        return (
          <div key={g} className={`${styles.card} ${styles.mini}`}>
            <div className={styles.miniTop}>
              <span className={styles.iconBox}><Icon size={18} /></span>
              <span className={styles.badgeMuted}>{pct1(s.pctOfBase(s.groups[g]))}</span>
            </div>
            <span className={styles.miniLabel}>{GROUPS[g].label}</span>
            <Amount value={s.groups[g]} />
            <span className={styles.miniSub}>{GROUPS[g].hint}</span>
          </div>
        )
      })}
    </div>
  )
}

const SIZE = 150
const STROKE = 20
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

export function Composition({ summary: s }: { summary: Summary }) {
  const free = Math.max(0, s.margin)
  const segs = [
    { key: 'free', label: 'Margem Livre', value: free, color: FREE_COLOR },
    { key: 'fixed', label: 'Fixos (Aluguel, Contas)', value: s.groups.fixed, color: GROUPS.fixed.color },
    { key: 'variable', label: 'Variáveis (Mercado, etc.)', value: s.groups.variable, color: GROUPS.variable.color },
    { key: 'leisure', label: 'Lazer & Assinaturas', value: s.groups.leisure, color: GROUPS.leisure.color },
  ]
  const sum = segs.reduce((a, x) => a + x.value, 0)
  const visible = segs.filter((x) => x.value > 0).length
  const gap = visible > 1 ? 3 : 0
  let offset = 0

  return (
    <section className={`${styles.card} ${styles.compCard}`}>
      <div className={styles.sectionHead}>
        <h2><PieChart size={18} /> Composição do Orçamento</h2>
        <small>Total: {brl0(s.base)}</small>
      </div>

      <div className={styles.donutWrap}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.donut} role="img" aria-label={`${s.freePct}% livre`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {sum > 0 && segs.filter((x) => x.value > 0).map((x) => {
              const len = Math.max(0, (x.value / sum) * C - gap)
              const el = (
                <circle
                  key={x.key} className={styles.seg} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                  stroke={x.color} strokeWidth={STROKE}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                  style={{ ['--c' as string]: C }}
                />
              )
              offset += (x.value / sum) * C
              return el
            })}
          </g>
        </svg>
        <div className={styles.donutCenter}><strong>{s.freePct}%</strong><small>LIVRE</small></div>
      </div>

      <ul className={styles.legend}>
        {segs.map((x) => (
          <li key={x.key}>
            <span><i style={{ background: x.color }} /> {x.label}</span>
            <b>{formatBRL(x.value)}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}
