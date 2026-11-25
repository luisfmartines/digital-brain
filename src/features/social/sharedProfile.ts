import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'

export interface ProfileRoutine {
  id: string; name: string; focus: string | null
  exercises: { name: string; sets: number; reps: number | null; rest: number }[]
}

export interface ProfileActivity {
  workoutCount: number | null; followers: number; following: number
  weekVolume?: { date: string; volume: number; workouts: number }[]
  photos: { url: string; name: string; at: string }[]
  workouts: {
    id: string; name: string; ended_at: string; seconds: number; volume: number
    exercises: { name: string; sets: number }[]
  }[]
  posts: { id: string; created_at: string; photo_url: string | null; caption: string | null; workout_id: string | null; workout_name: string | null }[]
}

interface SharedProfile {
  id: string
  name: string | null
  username: string | null
  avatar: string | null
  bio: string | null
  level: number | null
  sharing: boolean
  completion: number | null
  routines: ProfileRoutine[]
}

export function useSharedProfile(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'profile', user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SharedProfile>('public-profile', { body: { action: 'read', id } })
      if (error || !data) throw new Error('Não foi possível abrir esse perfil.')
      return data
    },
  })
}

export function useProfileActivity(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'profile-activity', user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ProfileActivity>('public-profile', { body: { action: 'activity', id } })
      if (error || !Array.isArray(data?.posts)) throw new Error('Não foi possível carregar a atividade.')
      return data
    },
  })
}

export function useCopySharedRoutine() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'routine' | 'workout' }) => {
      const { data, error } = await supabase.functions.invoke<{ id: string }>('public-profile', { body: { action: type === 'workout' ? 'copy_workout' : 'copy', id } })
      if (error || !data?.id) throw new Error('Não foi possível copiar a atividade.')
      return data.id
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export function useProfileSharing() {
  const { user } = useAuth()
  const cache = useQueryClient()
  const key = ['social', 'sharing', user?.id]
  const setting = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('share_profile_details').eq('id', user!.id).single()
      if (error) throw error
      return !!data.share_profile_details
    },
  })
  const change = useMutation({
    mutationFn: async (share: boolean) => {
      if (!user) throw new Error('Entre novamente para alterar o compartilhamento.')
      const { error } = await supabase.from('profiles').update({ share_profile_details: share }).eq('id', user.id)
      if (error) throw error
      return share
    },
    onSuccess: (share) => {
      cache.setQueryData(key, share)
      void cache.invalidateQueries({ queryKey: ['social', 'profile'] })
      void cache.invalidateQueries({ queryKey: ['social', 'profile-activity'] })
    },
  })
  return { setting, change }
}
