import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getExercise } from '../../features/exercisedb/api'
import { useExerciseLink, useExerciseMedia } from '../../features/exercisedb/queries'
import { useExercisePhoto } from '../../features/exercisedb/exercisePhoto'
import type { Exercise } from '../../features/workouts/queries'
import styles from './exerciseImage.module.css'

export default function ExerciseImage({ src, externalId, name, loading = false }: {
  src?: string | null; externalId?: string | null; name: string; loading?: boolean
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const needsRefresh = !src || failedUrls.includes(src)
  // Re-read the detail endpoint once when a catalogue URL is absent or broken.
  const recovery = useQuery({
    queryKey: ['exercisedb', 'image-recovery', externalId, src],
    enabled: !!externalId && needsRefresh && !loading,
    queryFn: () => getExercise(externalId!),
    staleTime: 60_000,
    retry: 1,
  })
  const url = needsRefresh ? recovery.data?.imageUrl : src
  if (url && !failedUrls.includes(url)) {
    return <img className={styles.image} src={url} alt={`Demonstração: ${name}`} loading="lazy" onError={() => setFailedUrls((urls) => [...urls, url])} />
  }
  const pending = loading || recovery.isFetching
  return <span className={styles.placeholder} role="img" aria-label={pending ? 'Carregando demonstração' : `Demonstração indisponível: ${name}`}>{pending ? 'Carregando…' : 'Sem demonstração'}</span>
}

export function CustomExercisePhoto({ path, name, thumbnail = false }: { path: string; name: string; thumbnail?: boolean }) {
  const photo = useExercisePhoto(path)
  if (!photo.data) return (
    <span className={thumbnail ? styles.placeholder : styles.photoMessage} role="img"
      aria-label={photo.isLoading ? 'Carregando foto' : `Foto indisponível: ${name}`}>
      {photo.isLoading ? 'Carregando…' : 'Foto indisponível'}
    </span>
  )
  return <img className={thumbnail ? styles.image : styles.fullPhoto} src={photo.data}
    loading="lazy" alt={`Foto de ${name}`} />
}

export function SavedExerciseImage({ exercise }: { exercise: Exercise }) {
  const { id, name, photo_path } = exercise
  return photo_path ? <CustomExercisePhoto path={photo_path} name={name} thumbnail /> :
    <CatalogExerciseImage exerciseId={id} name={name} />
}

function CatalogExerciseImage({ exerciseId, name }: { exerciseId: string; name: string }) {
  const link = useExerciseLink(exerciseId)
  const media = useExerciseMedia(link.data)
  return <ExerciseImage key={link.data ?? exerciseId} src={media.data?.imageUrl} externalId={link.data} name={name} loading={link.isLoading || media.isLoading} />
}
