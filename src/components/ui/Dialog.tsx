import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Dialog.module.css'

export default function Dialog({ title, children, onClose, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean
}) {
  const panel = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const node = panel.current
    node?.showModal()
    return () => { node?.close() }
  }, [])

  return (
    <dialog ref={panel} className={styles.dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.close} aria-label="Fechar" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
