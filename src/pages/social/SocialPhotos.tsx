import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import PhotoPicker from '../../components/ui/PhotoPicker'
import { photoError } from '../../features/social/publishing'
import styles from './Social.module.css'

export function PhotoPreview({ file, alt, onRemove, disabled }: { file: File; alt: string; onRemove: () => void; disabled: boolean }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className={styles.preview}>
      <img ref={image} alt={alt} />
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={'Remover ' + alt.toLowerCase()}><X size={16} /></button>
    </div>
  )
}

export function AddSocialPhoto({ label, onAdd, onPicking, disabled }: {
  label: string; onAdd: (file: File) => void; onPicking: (busy: boolean) => void; disabled: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <PhotoPicker title={label} onPickingChange={onPicking} onPhoto={(file) => {
        const error = photoError(file)
        setError(error)
        if (!error) onAdd(file)
      }}>
        {(open) => <button type="button" className={styles.secondary} disabled={disabled} aria-haspopup="dialog" onClick={open}>
          <ImagePlus size={18} /> {label}
        </button>}
      </PhotoPicker>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </>
  )
}
