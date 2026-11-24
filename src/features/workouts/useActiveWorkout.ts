import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'

export function useActiveWorkout() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'active', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts').select('id, name, started_at').eq('user_id', user!.id)
        .is('ended_at', null).is('deleted_at', null).order('started_at', { ascending: false }).limit(1)
      if (error) throw error
      return ((data ?? [])[0] ?? null) as { id: string; name: string; started_at: string } | null
    },
  })
}
