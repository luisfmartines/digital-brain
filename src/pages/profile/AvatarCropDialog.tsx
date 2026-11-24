import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Dialog from '../../components/ui/Dialog'
import dialogStyles from '../../components/ui/Dialog.module.css'
import styles from './Profile.module.css'

type Crop = { zoom: number; x: number; y: number }
const clamp = (value: number) => Math.max(-1, Math.min(1, value))
const SIZE = 512

function cropSide(image: ImageBitmap, zoom: number) {
  return Math.min(image.width, image.height) / zoom
}

function draw(canvas: HTMLCanvasElement, image: ImageBitmap, crop: Crop) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const side = cropSide(image, crop.zoom)
  const x = (image.width - side) * (crop.x + 1) / 2
  const y = (image.height - side) * (crop.y + 1) / 2
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(image, x, y, side, side, 0, 0, SIZE, SIZE)
  return true
}

export default function AvatarCropDialog({ file, onClose, onSave, uploading, uploadError }: {
  file: File; onClose: () => void; onSave: (blob: Blob) => void; uploading: boolean; uploadError?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: number; clientX: number; clientY: number; crop: Crop } | null>(null)
  const [image, setImage] = useState<ImageBitmap | null>(null)
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 })
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const busy = preparing || uploading

  useEffect(() => {
    let disposed = false
    let bitmap: ImageBitmap | undefined
    void createImageBitmap(file).then((value) => {
      if (disposed) value.close()
      else {
        bitmap = value
        setImage(value)
      }
    }, () => { if (!disposed) setError('Não foi possível abrir essa foto. Escolha outro arquivo.') })
    return () => { disposed = true; bitmap?.close() }
  }, [file])

  useEffect(() => {
    if (canvas.current && image) draw(canvas.current, image, crop)
  }, [image, crop])

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (!image || busy || event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, crop }
  }

  function moveDrag(event: PointerEvent<HTMLCanvasElement>) {
    const initial = drag.current
    if (!image || initial?.id !== event.pointerId) return
    const width = event.currentTarget.clientWidth
    const side = cropSide(image, initial.crop.zoom)
    if (!width) return
    const scale = 2 * side / width
    const maxX = image.width - side
    const maxY = image.height - side
    setCrop({
      zoom: initial.crop.zoom,
      x: maxX > 0 ? clamp(initial.crop.x - (event.clientX - initial.clientX) * scale / maxX) : 0,
      y: maxY > 0 ? clamp(initial.crop.y - (event.clientY - initial.clientY) * scale / maxY) : 0,
    })
  }

  function save() {
    const target = canvas.current
    if (!target || !image || busy) return
    if (!draw(target, image, crop)) {
      setError('Não foi possível preparar a foto.')
      return
    }
    setPreparing(true)
    setError('')
    target.toBlob((result) => {
      setPreparing(false)
      if (result) onSave(result)
      else setError('Não foi possível preparar a foto.')
    }, 'image/jpeg', 0.9)
  }

  return (
    <Dialog title="Ajustar foto do perfil" busy={busy} onClose={onClose}>
      <p className={dialogStyles.description}>Arraste a foto para enquadrar e use o zoom para aproximar. Você também pode movê-la com as setas do teclado.</p>
      {image && (
        <canvas ref={canvas} width={SIZE} height={SIZE} className={styles.avatarCrop} tabIndex={0}
          aria-label="Enquadramento da foto do perfil" onPointerDown={startDrag} onPointerMove={moveDrag}
          onLostPointerCapture={() => { drag.current = null }}
          onKeyDown={(event) => {
            const movement: Record<string, [number, number]> = {
              ArrowUp: [0, 0.1], ArrowDown: [0, -0.1], ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0],
            }
            const offset = movement[event.key]
            if (!offset || busy) return
            event.preventDefault()
            setCrop((current) => ({ ...current, x: clamp(current.x + offset[0]), y: clamp(current.y + offset[1]) }))
          }} />
      )}
      {!image && !error && <p role="status">Carregando foto…</p>}
      {image && <label className={styles.avatarZoom}>Zoom
        <input type="range" min={1} max={3} step={0.05} value={crop.zoom} disabled={busy}
          onChange={(event) => setCrop({ ...crop, zoom: Number(event.currentTarget.value) })} />
      </label>}
      {(error || uploadError) && <p role="alert" className={styles.error}>{error || uploadError}</p>}
      <div className={dialogStyles.actions}>
        <button type="button" className={dialogStyles.button} onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="button" className={dialogStyles.button + ' ' + dialogStyles.primary}
          disabled={!image || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar foto'}</button>
      </div>
    </Dialog>
  )
}
