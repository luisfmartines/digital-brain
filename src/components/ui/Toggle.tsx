import styles from './Toggle.module.css'

interface Props {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}

export default function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.toggle} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}