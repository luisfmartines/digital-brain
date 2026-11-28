import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Flag, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PhotoPicker from '../../components/ui/PhotoPicker'
import { useFinalizeWorkout, type Session } from '../../features/workouts/queries'
import { fmtNum, resizeImage, volumeOf } from '../../features/workouts/utils'
import styles from './workouts.module.css'

const maxPhotos = 6

function DraftThumbnail({ photo, index, disabled, onRemove }: {
  photo: Blob; index: number; disabled: boolean; onRemove: () => void
}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return (
    <div className={styles.photoCard}>
      <img ref={image} alt={`Foto ${index + 1} do treino`} />
      <button type="button" className={styles.removePhoto} disabled={disabled} onClick={onRemove}
        aria-label={`Remover foto ${index + 1}`}><Trash2 size={17} /></button>
    </div>
  )
}

export default function WorkoutReview({ session, updateRoutine }: { session: Session; updateRoutine: boolean }) {
  const navigate = useNavigate()
  const finalize = useFinalizeWorkout(session.id)
  const [photos, setPhotos] = useState<{ id: number; blob: Blob }[]>([])
  const nextPhoto = useRef(0)
  const [picking, setPicking] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const completed = session.workout_sets.filter((set) => set.completed).length
  const pending = !session.workout_sets.length || session.workout_sets.some((set) => !set.completed || (set.reps ?? 0) < 1)
  const busy = preparing || picking || finalize.isPending
  const back = () => navigate(`/workouts/active/${session.id}`, { replace: true })

  async function addPhoto(file: File) {
    setPhotoError('')
    setPreparing(true)
    try {
      const blob = await resizeImage(file, 1280)
      const id = nextPhoto.current++
      setPhotos((current) => current.length < maxPhotos ? [...current, { id, blob }] : current)
    } catch {
      setPhotoError('Não foi possível abrir esta foto. Tente novamente ou escolha outra imagem.')
    } finally {
      setPreparing(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={back} disabled={busy} aria-label="Voltar ao treino"><ArrowLeft size={20} /></button>
          <h1 className={styles.headerTitle}>Revisar treino</h1>
        </header>

        <section className={styles.reviewHeading}>
          <h2>{session.name}</h2>
          <p>{completed} {completed === 1 ? 'série concluída' : 'séries concluídas'} · {fmtNum(volumeOf(session.workout_sets))} kg de volume</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <span><Camera size={15} /> Fotos do treino</span>
            <small>{photos.length}/{maxPhotos}</small>
          </div>
          <div className={styles.mediaGrid}>
            {photos.map(({ id, blob }, index) => (
              <DraftThumbnail key={id} photo={blob} index={index} disabled={finalize.isPending}
                onRemove={() => setPhotos((current) => current.filter((photo) => photo.id !== id))} />
            ))}
            {photos.length < maxPhotos && (
              <PhotoPicker title="Adicionar foto do treino" onPhoto={addPhoto} onPickingChange={setPicking}>
                {(open) => <button type="button" className={styles.addPhoto} aria-haspopup="dialog" onClick={open} disabled={busy}>
                  <Camera size={20} /><b>{preparing ? 'Preparando foto…' : 'Adicionar foto'}</b>
                </button>}
              </PhotoPicker>
            )}
          </div>
          {photoError && <p className={styles.error} role="alert">{photoError}</p>}
        </section>

        <p className={styles.publishNote}>O treino e as fotos selecionadas serão publicados no feed ao finalizar.</p>
        {pending && <p className={styles.error} role="alert">Volte ao treino e conclua as séries pendentes.</p>}
        {finalize.error && <p className={styles.error} role="alert">{finalize.error.message}</p>}
        <button type="button" className={styles.primary} disabled={busy || pending}
          onClick={() => finalize.mutate({ photos: photos.map(({ blob }) => blob), updateRoutine })}>
          <Flag size={15} /> {finalize.isPending ? 'Finalizando…' : 'Finalizar treino'}
        </button>
      </div>
    </div>
  )
}
