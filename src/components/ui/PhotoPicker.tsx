import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Camera, Image } from 'lucide-react'
import { useDevice } from '../../expo/device'
import Dialog from './Dialog'
import styles from './Dialog.module.css'

export default function PhotoPicker({ title, onPhoto, onPickingChange, children, accept = 'image/*', camera = 'environment' }: {
  title: string
  onPhoto: (file: File) => void
  onPickingChange?: (picking: boolean) => void
  children: (open: () => void) => ReactNode
  accept?: string
  camera?: 'environment' | 'user'
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [capturing, setCapturing] = useState(false)
  const device = useDevice()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  function choose(input: HTMLInputElement | null) {
    // The input is outside the modal and must be active within the same tap.
    flushSync(() => setOpen(false))
    input?.click()
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onPhoto(file)
  }

  async function pick(source: 'camera' | 'gallery') {
    if (!device || (source === 'gallery' && accept !== 'image/*')) {
      choose(source === 'camera' ? cameraInput.current : galleryInput.current)
      return
    }
    setOpen(false)
    setCapturing(true)
    onPickingChange?.(true)
    try {
      const result = await (source === 'camera' ? device.takePhoto(camera) : device.pickPhoto())
      if (!result) return
      const decoded = atob(result.base64)
      const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
      onPhoto(new File([bytes], 'foto.jpg', { type: result.mimeType }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a imagem. Tente novamente.')
      setOpen(true)
    } finally {
      setCapturing(false)
      onPickingChange?.(false)
    }
  }

  return (
    <>
      {children(() => { if (!capturing) { setError(''); setOpen(true) } })}
      <input ref={cameraInput} type="file" accept="image/*" capture={camera} hidden onChange={selectPhoto} />
      <input ref={galleryInput} type="file" accept={accept} hidden onChange={selectPhoto} />
      {open && (
        <Dialog title={title} onClose={() => setOpen(false)}>
          {error && <p role="alert">{error}</p>}
          <button type="button" className={styles.choice} onClick={() => void pick('camera')}>
            Usar câmera <Camera size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.choice} onClick={() => void pick('gallery')}>
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
