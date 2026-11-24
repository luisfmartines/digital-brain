import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const AVATAR_SIZE = 512

async function prepareAvatar(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Escolha uma foto JPG, PNG ou WebP.')
  if (file.size > MAX_FILE_SIZE) throw new Error('A foto pode ter até 10 MB.')

  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error('Não foi possível abrir essa foto. Escolha outro arquivo.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext('2d')
  try {
    if (!context) throw new Error('Não foi possível preparar a foto.')
    const side = Math.min(image.width, image.height)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2,
      side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  } finally {
    image.close()
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível preparar a foto.'))
    }, 'image/jpeg', 0.9)
  })
}

export function useUploadAvatar() {
  const { user } = useAuth()
  const cache = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Entre novamente para enviar a foto.')
      const photo = await prepareAvatar(file)
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
