import type { ReactNode } from 'react'
import Dialog from './Dialog'
import styles from './ActionSheet.module.css'

export default function ActionSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog title={title} onClose={onClose} className={styles.sheet}><div className={styles.choices}>{children}</div></Dialog>
}
