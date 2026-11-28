import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './FloatingAction.module.css'

type Action = { label: string } & ({ to: string; state?: unknown } | { onClick: () => void })

export default function FloatingAction({ label, ...action }: Action) {
  return (
    <div className={styles.space}>
      <div className={styles.fixed}>
        {'to' in action
          ? <Link to={action.to} state={action.state} className={styles.button} aria-label={label} title={label} draggable={false}><Plus size={26} /></Link>
          : <button type="button" onClick={action.onClick} className={styles.button} aria-label={label} title={label} aria-haspopup="dialog"><Plus size={26} /></button>}
      </div>
    </div>
  )
}
