import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { resizeImage } from '../workouts/utils'

const bucket = () => supabase.storage.from('exercise-photos')

export async function uploadExercisePhoto(path: string, file: File) {
  const image = await resizeImage(file, 1280).catch(() => {
    throw new Error('Não foi possível abrir esta imagem. Escolha outra foto.')
  })
  const { error } = await bucket().upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw new Error('Não foi possível enviar a foto. Tente novamente.')
}

export async function removeExercisePhoto(path: string) {
  await bucket().remove([path])
}

export function useExercisePhoto(path?: string | null) {
  const { user } = useAuth()
  const refresh = 45 * 60 * 1000
  return useQuery({
    queryKey: ['exercisedb', 'photo', user?.id, path],
    enabled: !!user && !!path,
    staleTime: refresh,
    refetchInterval: refresh,
    queryFn: async () => {
      const { data, error } = await bucket().createSignedUrl(path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}
