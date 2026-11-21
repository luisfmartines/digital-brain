import styles from './onboarding.module.css'

export default function MoneyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const text = value
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
  return (
    <div className={styles.money}>
      <span>R$</span>
      <input
        inputMode="numeric"
        placeholder="0,00"
        value={text}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '')) / 100)}
      />
    </div>
  )
}