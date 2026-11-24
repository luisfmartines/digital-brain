import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024
export function validateAvatarFile(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Escolha uma foto JPG, PNG ou WebP.'
  if (file.size > MAX_FILE_SIZE) return 'A foto pode ter até 10 MB.'
  return ''
}

export function useUploadAvatar() {
  const { user } = useAuth()
  const cache = useQueryClient()

  return useMutation({
    mutationFn: async (photo: Blob) => {
      if (!user) throw new Error('Entre novamente para enviar a foto.')
      const storage = supabase.storage.from('avatars')
      const path = `${user.id}/profile.jpg`
      const upload = await storage.upload(path, photo, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
      if (upload.error) throw new Error('Não foi possível enviar a foto. Tente novamente.')

      const url = new URL(storage.getPublicUrl(path).data.publicUrl)
      url.searchParams.set('v', crypto.randomUUID())
      const { error } = await supabase.from('profiles').update({ avatar_url: url.href })
        .eq('id', user.id).select('id').single()
      if (error) throw new Error('Não foi possível salvar a foto no perfil. Tente novamente.')
      return user.id
    },
    onSuccess: (userId) => cache.invalidateQueries({ queryKey: ['profile', userId] }),
  })
}
