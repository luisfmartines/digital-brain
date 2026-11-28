import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

const pageSize = 12
interface MediaWorkout {
  id: string
  name: string
  ended_at: string
  photo_url: string | null
  photo_urls: string[] | null
}
type Cursor = Pick<MediaWorkout, 'id' | 'ended_at'>

export function useProfileMedia(target?: string) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: ['social', 'profile-media', user?.id, target],
    enabled: !!user && !!target,
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam, signal }) => {
      const query = supabase.from('workouts').select('id, name, ended_at, photo_url, photo_urls')
        .eq('user_id', target!).not('ended_at', 'is', null).is('deleted_at', null).not('photo_url', 'is', null)
      if (pageParam) {
        query.or(`ended_at.lt.${pageParam.ended_at},and(ended_at.eq.${pageParam.ended_at},id.lt.${pageParam.id})`)
      }
      const { data, error } = await query.order('ended_at', { ascending: false }).order('id', { ascending: false })
        .limit(pageSize + 1).abortSignal(signal)
      if (error) throw error
      const workouts = (data ?? []) as MediaWorkout[]
      const last = workouts[pageSize - 1]
      return {
        photos: workouts.slice(0, pageSize).flatMap((workout) => {
          const urls = workout.photo_urls?.length ? workout.photo_urls : workout.photo_url ? [workout.photo_url] : []
          return [...new Set(urls)].map((url) => ({ url, workoutId: workout.id, name: workout.name, at: workout.ended_at }))
        }),
        next: workouts.length > pageSize ? { id: last.id, ended_at: last.ended_at } : null,
      }
    },
    getNextPageParam: (last) => last.next,
  })
}
