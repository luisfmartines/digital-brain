import { useState } from 'react'
import Dialog from './Dialog'
import styles from './Dialog.module.css'

interface Confirmation {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm?: () => void
}

export function useConfirmation() {
  const [request, ask] = useState<Confirmation | null>(null)
  const close = () => ask(null)
  const dialog = request && (
    <Dialog title={request.title} onClose={close}>
      {request.description && <p className={styles.description}>{request.description}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={close}>{request.onConfirm ? 'Cancelar' : 'Entendi'}</button>
        {request.onConfirm && (
          <button type="button" className={styles.button + ' ' + (request.danger ? styles.danger : styles.primary)}
            onClick={() => { close(); request.onConfirm?.() }}>{request.confirmLabel ?? 'Confirmar'}</button>
        )}
      </div>
    </Dialog>
  )
  return { ask, dialog }
}
