import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { exerciseGroup, getExercise, listExercises, searchExercises } from './api'
import type { ExerciseMedia } from './types'
import type { Exercise } from '../workouts/queries'

const DAY = 24 * 60 * 60 * 1000

export function useExerciseCatalog(term: string, muscle: string) {
  return useInfiniteQuery({
    queryKey: ['exercisedb', 'catalog', term.trim().toLowerCase(), muscle],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listExercises(term, muscle, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: DAY,
    retry: 1,
  })
}

export function useImportExercise() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (media: ExerciseMedia) => {
      if (!user) throw new Error('Entre novamente para adicionar exercícios.')
      // Stable per-user ID makes retries and repeated selections reuse the same exercise.
      const id = `${user.id}:${media.id}`
      const { data, error } = await supabase.from('exercises').upsert({
        id, user_id: user.id, name: media.name, muscle_group: exerciseGroup(media),
        equipment: media.equipments.join(', ') || null,
      }).select('id, user_id, name, muscle_group, equipment').single()
      if (error) throw error
      const link = await supabase.from('exercise_media_links').upsert({
        user_id: user.id, exercise_id: id, external_id: media.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_id' })
      if (link.error) throw link.error
      qc.setQueryData(['exercisedb', 'detail', media.id], media)
      return data as Exercise
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workouts', 'exercises'] })
      void qc.invalidateQueries({ queryKey: ['exercisedb', 'link'] })
    },
  })
}

// Qual exercício da ExerciseDB representa este exercício do usuário
export function useExerciseLink(exerciseId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['exercisedb', 'link', user?.id, exerciseId],
    enabled: !!user && !!exerciseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_media_links').select('external_id').eq('exercise_id', exerciseId!).maybeSingle()
      if (error) throw error
      return (data?.external_id ?? null) as string | null
    },
  })
}

export function useLinkExercise(exerciseId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (externalId: string) => {
      const { error } = await supabase
        .from('exercise_media_links')
        .upsert({ user_id: user!.id, exercise_id: exerciseId, external_id: externalId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,exercise_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercisedb', 'link'] }),
  })
}

export function useUnlinkExercise(exerciseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('exercise_media_links').delete().eq('exercise_id', exerciseId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercisedb', 'link'] }),
  })
}

export function useExerciseMedia(externalId?: string | null) {
  return useQuery({
    queryKey: ['exercisedb', 'detail', externalId],
    enabled: !!externalId,
    staleTime: 7 * DAY,
    gcTime: 7 * DAY,
    retry: 1,
    queryFn: () => getExercise(externalId!),
  })
}

export function useExerciseSearch(term: string) {
  const t = term.trim()
  return useQuery({
    queryKey: ['exercisedb', 'search', t.toLowerCase()],
    enabled: t.length >= 2,
    staleTime: DAY,
    retry: 1,
    queryFn: () => searchExercises(t),
  })
}
