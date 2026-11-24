import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Camera, Image } from 'lucide-react'
import Dialog from './Dialog'
import styles from './Dialog.module.css'

export default function PhotoPicker({ title, onPhoto, children, accept = 'image/*', camera = 'environment' }: {
  title: string
  onPhoto: (file: File) => void
  children: (open: () => void) => ReactNode
  accept?: string
  camera?: 'environment' | 'user'
}) {
  const [open, setOpen] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  function choose(button: HTMLButtonElement, input: HTMLInputElement | null) {
    // Close the modal before the file picker opens, within the same tap.
    button.closest('dialog')?.close()
    setOpen(false)
    input?.click()
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onPhoto(file)
  }

  return (
    <>
      {children(() => setOpen(true))}
      <input ref={cameraInput} type="file" accept="image/*" capture={camera} hidden onChange={selectPhoto} />
      <input ref={galleryInput} type="file" accept={accept} hidden onChange={selectPhoto} />
      {open && (
        <Dialog title={title} onClose={() => setOpen(false)}>
          <button type="button" className={styles.choice} onClick={(event) => choose(event.currentTarget, cameraInput.current)}>
            Usar câmera <Camera size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.choice} onClick={(event) => choose(event.currentTarget, galleryInput.current)}>
            Escolher da galeria <Image size={18} aria-hidden="true" />
          </button>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </Dialog>
      )}
    </>
  )
}
