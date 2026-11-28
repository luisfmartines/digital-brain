import { Camera, Trash2 } from 'lucide-react'
import { useConfirmation } from '../../components/ui/useConfirmation'
import { useRemoveFinishedWorkoutPhoto } from '../../features/workouts/queries'
import styles from './workouts.module.css'

export default function FinishedWorkoutPhotos({ workoutId, photos }: { workoutId: string; photos: string[] }) {
  const confirmation = useConfirmation()
  const remove = useRemoveFinishedWorkoutPhoto(workoutId)
  if (!photos.length) return null

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHead}><span><Camera size={14} /> Fotos do treino</span></div>
      <div className={styles.mediaGrid}>
        {photos.map((url, index) => (
          <div className={styles.photoCard} key={url}>
            <img src={url} alt={`Foto ${index + 1} do treino`} loading="lazy" />
            <button type="button" className={styles.removePhoto} disabled={remove.isPending}
              aria-label={`Remover foto ${index + 1}`} onClick={() => confirmation.ask({
                title: 'Remover esta foto?',
                description: 'A foto será removida do treino e da publicação no feed.',
                confirmLabel: 'Remover foto',
                danger: true,
                onConfirm: () => remove.mutate(url),
              })}>
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      {remove.isPending && <p className={styles.publishNote} role="status">Removendo foto…</p>}
      {remove.error && <p className={styles.error} role="alert">{remove.error.message}</p>}
      {confirmation.dialog}
    </section>
  )
}
