import styles from './finance.module.css'

interface Props {
  value: number
  onChange: (n: number) => void
  label: string
  autoFocus?: boolean
  className?: string
}

// Digita só números; o valor vai preenchendo da direita pra esquerda (centavos)
export default function MoneyField({ value, onChange, label, autoFocus, className }: Props) {
  const text = value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  return (
    <label className={`${styles.money} ${className ?? ''}`}>
      <span>R$</span>
      <input
        inputMode="numeric"
        placeholder="0,00"
        value={text}
        autoFocus={autoFocus}
        aria-label={label}
        onChange={(e) => onChange(Math.min(99999999.99, Number(e.target.value.replace(/\D/g, '')) / 100))}
      />
    </label>
  )
}
