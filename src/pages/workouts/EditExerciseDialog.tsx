import { useEffect, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import ChoiceField from '../../components/ui/ChoiceField'
import Dialog from '../../components/ui/Dialog'
import PhotoPicker from '../../components/ui/PhotoPicker'
import { useEditExercise, type Exercise } from '../../features/workouts/queries'
import { MUSCLES } from '../../features/workouts/utils'
import { CustomExercisePhoto } from './ExerciseImage'
import styles from './workouts.module.css'

const groups = Object.entries(MUSCLES).map(([value, label]) => ({ value, label }))

export default function EditExerciseDialog({ exercise, onClose, onSaved }: {
  exercise: Exercise; onClose: () => void; onSaved?: (exercise: Exercise) => void
}) {
  const [name, setName] = useState(exercise.name)
  const [muscle, setMuscle] = useState(exercise.muscle_group)
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const edit = useEditExercise()
  const preview = photo?.preview
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <Dialog title="Editar exercício" busy={edit.isPending} onClose={onClose}>
      <form className={styles.editExerciseForm} onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim() || edit.isPending) return
        edit.mutate({ exercise, name: name.trim(), muscle_group: muscle, photo: photo?.file ?? null }, {
          onSuccess: (saved) => { onSaved?.(saved); onClose() },
        })
      }}>
        <label>Nome do exercício<input className={styles.input} value={name} required disabled={edit.isPending}
          onChange={(event) => setName(event.target.value)} /></label>
        <ChoiceField label="Grupo muscular" value={muscle} onChange={setMuscle} options={groups} disabled={edit.isPending} />
        <PhotoPicker title="Foto do exercício" onPhoto={(file) => setPhoto({ file, preview: URL.createObjectURL(file) })}>
          {(open) => (
            <button type="button" className={styles.exercisePhotoField} onClick={open} disabled={edit.isPending}
              aria-haspopup="dialog" data-selected={!!(photo || exercise.photo_path)}>
              {photo ? <img src={photo.preview} alt="Prévia da foto do exercício" /> : exercise.photo_path
                ? <CustomExercisePhoto path={exercise.photo_path} name={exercise.name} /> : <ImagePlus size={24} aria-hidden="true" />}
              <span>{photo || exercise.photo_path ? 'Trocar foto' : 'Adicionar foto'}</span>
            </button>
          )}
        </PhotoPicker>
        {edit.error && <p className={styles.error} role="alert">{edit.error.message}</p>}
        <button className={styles.primary} disabled={!name.trim() || edit.isPending}>{edit.isPending ? 'Salvando…' : 'Salvar exercício'}</button>
      </form>
    </Dialog>
  )
}
