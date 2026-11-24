import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { addDays, localDateStr } from '../../lib/date'
import { volumeOf, workoutSeconds, type SetLike } from '../workouts/utils'

export interface Profile { id: string; display_name: string | null; username: string | null; avatar_url: string | null }

const PROFILE_COLS = 'id, display_name, username, avatar_url'

async function profilesByIds(ids: string[]) {
  const map = new Map<string, Profile>()
  if (!ids.length) return map
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).in('id', ids)
  if (error) throw error
  for (const p of (data ?? []) as Profile[]) map.set(p.id, p)
  return map
}

/* ---------- Seguir ---------- */

export function useFollowing() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'following', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', user!.id)
      if (error) throw error
      return new Set(((data ?? []) as { following_id: string }[]).map((r) => r.following_id))
    },
  })
}

export function useFollowingProfiles() {
  const following = useFollowing()
  const ids = [...(following.data ?? [])].sort()
  const profiles = useQuery({
    queryKey: ['social', 'following-profiles', 'profiles', ids],
    enabled: following.isSuccess && ids.length > 0,
    queryFn: async () => [...(await profilesByIds(ids)).values()].sort((a, b) =>
      (a.display_name ?? a.username ?? '').localeCompare(b.display_name ?? b.username ?? '', 'pt-BR')),
  })
  return { following: following.data, profiles: profiles.data ?? [], loading: following.isPending || profiles.isLoading, error: following.isError || profiles.isError }
}

export function useFollowToggle() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, following }: { id: string; following: boolean }) => {
      const { error } = following
        ? await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', id)
        : await supabase.from('follows').insert({ following_id: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social'] }),
  })
}

export function useSearchProfiles(q: string) {
  const { user } = useAuth()
  const term = q.trim().toLowerCase().replace(/^@/, '')
  return useQuery({
    queryKey: ['social', 'search', term],
    enabled: !!user && term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLS).ilike('username', `%${term}%`).neq('id', user!.id).limit(10)
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

/* ---------- Feed ---------- */

interface RawPost {
  id: string; user_id: string; caption: string | null; photo_url: string | null; created_at: string
  workout: {
    id: string; name: string; started_at: string; ended_at: string | null; paused_seconds: number
    workout_sets: (SetLike & { exercise: { name: string } | null })[]
  } | null
}

export interface FeedComment { id: string; user_id: string; content: string; created_at: string; author?: Profile }
export interface FeedPost {
  id: string; created_at: string; photo_url: string | null; author?: Profile
  workout: { id: string; name: string; volume: number; minutes: number; top: { name: string; weight: number } | null } | null
  likes: number; liked: boolean; comments: FeedComment[]
}

export function useFeed() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'feed', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, user_id, caption, photo_url, created_at, workout:workouts(id, name, started_at, ended_at, paused_seconds, workout_sets(weight_kg, reps, completed, is_warmup, exercise:exercises(name)))')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      const posts = (data ?? []) as unknown as RawPost[]
      const ids = posts.map((p) => p.id)

      const likes = ids.length ? await supabase.from('post_likes').select('post_id, user_id').in('post_id', ids) : { data: [] }
      const comments = ids.length
        ? await supabase.from('post_comments').select('id, post_id, user_id, content, created_at').in('post_id', ids).order('created_at')
        : { data: [] }
      const likeRows = (likes.data ?? []) as { post_id: string; user_id: string }[]
      const commentRows = (comments.data ?? []) as (FeedComment & { post_id: string })[]

      const people = await profilesByIds([...new Set([...posts.map((p) => p.user_id), ...commentRows.map((c) => c.user_id)])])

      return posts.map((p): FeedPost => {
        const w = p.workout
        let top: { name: string; weight: number } | null = null
        if (w) for (const s of w.workout_sets) {
          if (s.completed && !s.is_warmup && (s.weight_kg ?? 0) > (top?.weight ?? 0)) top = { name: s.exercise?.name ?? 'Exercício', weight: s.weight_kg ?? 0 }
        }
        return {
          id: p.id,
          created_at: p.created_at,
          photo_url: p.photo_url,
          author: people.get(p.user_id),
          workout: w
            ? { id: w.id, name: w.name, volume: volumeOf(w.workout_sets), minutes: Math.max(1, Math.round(workoutSeconds({ ...w, paused_at: null }, 0) / 60)), top }
            : null,
          likes: likeRows.filter((l) => l.post_id === p.id).length,
          liked: likeRows.some((l) => l.post_id === p.id && l.user_id === user!.id),
          comments: commentRows.filter((c) => c.post_id === p.id).map((c) => ({ ...c, author: people.get(c.user_id) })),
        }
      })
    },
  })
}

export function useToggleLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, liked, userId }: { postId: string; liked: boolean; userId: string }) => {
      const { error } = liked
        ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
        : await supabase.from('post_likes').insert({ post_id: postId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'feed'] }),
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { error } = await supabase.from('post_comments').insert({ post_id: postId, content })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'feed'] }),
  })
}

/* ---------- Ranking da semana ---------- */

export interface Rival {
  user_id: string; display_name: string | null; username: string | null; avatar_url: string | null
  volume_kg: number; minutes: number; sets: number; workouts: number; xp: number; last_workout: string | null
}

export function useLeaderboard(weekStart: Date) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'board', user?.id, localDateStr(weekStart)],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leaderboard_week', {
        from_ts: weekStart.toISOString(),
        to_ts: addDays(weekStart, 7).toISOString(),
      })
      if (error) throw error
      return ((data ?? []) as Rival[]).map((r) => ({ ...r, volume_kg: Number(r.volume_kg) }))
    },
  })
}

/* ---------- Detalhe completo de um treino (feed) ---------- */

export interface WorkoutDetailSet { id: string; exercise_id: string; set_number: number; exercise_order: number; weight_kg: number | null; reps: number | null; is_warmup: boolean; completed: boolean; exercise: { name: string; muscle_group: string } | null }
export interface WorkoutDetail {
  id: string; name: string; started_at: string; ended_at: string | null; paused_seconds: number; photo_url: string | null
  author?: Profile
  sets: WorkoutDetailSet[]
}

export function useWorkoutDetail(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'workout-detail', id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<WorkoutDetail | null> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, user_id, name, started_at, ended_at, paused_seconds, photo_url, workout_sets(id, exercise_id, set_number, exercise_order, weight_kg, reps, is_warmup, completed, exercise:exercises(name, muscle_group))')
        .eq('id', id!).is('deleted_at', null).maybeSingle()
      if (error) throw error
      if (!data) return null
      const { user_id, workout_sets, ...w } = data as unknown as Omit<WorkoutDetail, 'sets' | 'author'> & { user_id: string; workout_sets: WorkoutDetailSet[] }
      const people = await profilesByIds([user_id])
      return { ...w, author: people.get(user_id), sets: workout_sets ?? [] }
    },
  })
}


/* ---------- Conectar amigos ---------- */

export interface SuggestedProfile extends Profile { level: number | null }

// Quem já te segue (a tela filtra quem você já segue de volta)
export function useFollowers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'followers', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('follows').select('follower_id').eq('following_id', user!.id)
      if (error) throw error
      const ids = ((data ?? []) as { follower_id: string }[]).map((r) => r.follower_id)
      return [...(await profilesByIds(ids)).values()]
    },
  })
}

// Perfis para recomendar (os mais ativos primeiro); a tela remove quem você já segue
export function useSuggestedProfiles() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['social', 'suggested', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles').select(`${PROFILE_COLS}, level`)
        .not('username', 'is', null).neq('id', user!.id)
        .order('xp', { ascending: false }).limit(30)
      if (error) throw error
      return (data ?? []) as SuggestedProfile[]
    },
  })
}
