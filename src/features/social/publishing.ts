import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import type { ActivityCategory } from '../workouts/activities'
import { resizeImage } from '../workouts/utils'

export const MAX_PHOTOS = 6
const MAX_BYTES = 6 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function photoError(file: File) {
  if (!IMAGE_TYPES.has(file.type)) return 'Escolha uma foto JPG, PNG, WebP ou GIF.'
  if (file.size > MAX_BYTES) return 'Cada foto pode ter até 6 MB.'
  if (!file.size) return 'A foto está vazia.'
  return null
}

export async function withSocialPhotos<T>(
  userId: string, draftId: string, files: File[], save: (urls: string[]) => Promise<{ data: T; error: { code: string } | null }>,
) {
  const bucket = supabase.storage.from('post-media')
  const uploaded: string[] = []
  async function cleanUp(urls: string[] = []) {
    const unused = uploaded.filter((path) => !urls.includes(bucket.getPublicUrl(path).data.publicUrl))
    if (unused.length) await bucket.remove(unused).catch(() => undefined)
  }
  const results = await Promise.allSettled(files.map(async (file) => {
    const invalid = photoError(file)
    if (invalid) throw new Error(invalid)
    const image = await resizeImage(file, 1280)
    const path = userId + '/' + draftId + '-' + crypto.randomUUID() + '.jpg'
    const { error } = await bucket.upload(path, image, { contentType: 'image/jpeg' })
    if (error) throw error
    uploaded.push(path)
    return bucket.getPublicUrl(path).data.publicUrl
  }))
  const urls = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  if (urls.length !== files.length) {
    await cleanUp()
    throw new Error('Não foi possível enviar todas as fotos. Tente novamente.')
  }
  const result = await save(urls)
  if (result.error) {
    if (/^[0-9A-Z]{5}$/.test(result.error.code) || result.error.code === 'PGRST202') await cleanUp()
    throw new Error('Não foi possível salvar. Tente novamente.')
  }
  return { data: result.data, cleanUp }
}

interface PublishInput {
  id: string
  caption: string
  photos: File[]
  discoverable: boolean
  category?: ActivityCategory
}

export function usePublishPost() {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, caption, photos, discoverable, category }: PublishInput) => {
      if (!user) throw new Error('Entre novamente para publicar.')
      const { data, cleanUp } = await withSocialPhotos(user.id, id, photos, async (urls) =>
        await supabase.rpc('publish_social_post', {
          draft_id: id, post_caption: caption, selected_photos: urls, explore: discoverable,
          activity_category: category ?? null, activity_name: null, activity_minutes: null, activity_distance: null,
        }))
      if (Array.isArray(data)) await cleanUp(data)
    },
    onSuccess: () => Promise.all([
      cache.invalidateQueries({ queryKey: ['social'] }),
      cache.invalidateQueries({ queryKey: ['workouts'] }),
      cache.invalidateQueries({ queryKey: ['profile'] }),
      cache.invalidateQueries({ queryKey: ['home'] }),
    ]),
  })
}
