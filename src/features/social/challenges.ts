import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export interface Challenge {
  id: string
  name: string
  description: string
  starts_on: string
  ends_on: string
  duration_days: number
  participant_count: number
  active_days: number
  joined: boolean
  is_creator: boolean
  closed: boolean
}

const PAGE_SIZE = 20
const KEY = ['social', 'challenges']

export function useChallenges() {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: [...KEY, user?.id],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.rpc('list_workout_challenges', { page_offset: pageParam }).abortSignal(signal)
      if (error) throw error
      return (data ?? []) as Challenge[]
    },
    getNextPageParam: (page, _pages, offset) => page.length === PAGE_SIZE ? offset + PAGE_SIZE : undefined,
  })
}

export function useCreateChallenge() {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (challenge: { id: string; name: string; description: string; starts_on: string; duration_days: number }) => {
      if (!user) throw new Error('Entre novamente para criar o desafio.')
      const { error } = await supabase.from('workout_challenges')
        .upsert({ ...challenge, created_by: user.id }, { ignoreDuplicates: true })
      if (error) throw new Error('Não foi possível criar o desafio. Confira a data e tente novamente.')
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: KEY }),
  })
}

export function useChallengeMembership(challengeId: string) {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (join: boolean) => {
      if (!user) throw new Error('Entre novamente para atualizar sua participação.')
      const { error } = join
        ? await supabase.from('workout_challenge_members')
          .upsert({ challenge_id: challengeId, user_id: user.id }, { ignoreDuplicates: true })
        : await supabase.from('workout_challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', user.id)
      if (error) throw new Error('Não foi possível atualizar sua participação. Tente novamente.')
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: KEY }),
  })
}
