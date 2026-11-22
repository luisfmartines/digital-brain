import styles from './habits.module.css'

export type View = 'weekly' | 'monthly' | 'yearly'

const OPTIONS: { id: View; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]

export function ViewSwitch({ view, onChange, compact }: { view: View; onChange: (v: View) => void; compact?: boolean }) {
  return (
    <div className={`${styles.switch} ${compact ? styles.switchCompact : ''}`} role="tablist">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={view === o.id}
          className={view === o.id ? styles.switchOn : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}