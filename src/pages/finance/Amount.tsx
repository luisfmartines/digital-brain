import { brlParts } from '../../features/finance/format'
import styles from './finance.module.css'

// "R$ 5.500,00" com o símbolo e os centavos menores
export default function Amount({ value, size = 'md' }: { value: number; size?: 'lg' | 'md' }) {
  const { neg, int, cents } = brlParts(value)
  return (
    <span className={`${styles.amount} ${size === 'lg' ? styles.amountLg : ''}`}>
      {neg && '-'}<span className={styles.cur}>R$</span> <span className={styles.int}>{int}</span><span className={styles.cents}>,{cents}</span>
    </span>
  )
}
