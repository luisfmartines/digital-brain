import styles from './habits.module.css'

export type View = 'weekly' | 'monthly' | 'yearly'

const OPTIONS: { id: View; label: string }[] = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'yearly', label: 'Anual' },
]

export function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className={styles.switch} role="tablist" aria-label="Período dos hábitos">
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