import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'
import type { ActivityCategory } from '../workouts/activities'
import type { Profile } from './queries'
import { withSocialPhotos } from './publishing'

export interface Community {
  id: string
  owner_id: string
  name: string
  bio: string
  category: ActivityCategory
  photo_url: string | null
  member_total: number
}

const COLUMNS = 'id, owner_id, name, bio, category, photo_url'
const people = 'id, display_name, username, avatar_url'
const key = ['social', 'communities']
const MEMBERS_PER_PAGE = 24

export function memberCount(community: Community) {
  return community.member_total
}

export function useCommunityDirectory(category: ActivityCategory | '', search: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...key, 'directory', user?.id, category, search],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_community_cards', {
        mine_only: false, category_filter: category || null, search_term: search || null,
      }).abortSignal(signal)
      if (error) throw error
      return data as Community[]
    },
  })
}

export function useMyCommunities() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...key, 'mine', user?.id],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_community_cards', {
        mine_only: true, category_filter: null, search_term: null,
      }).abortSignal(signal)
      if (error) throw error
      return data as Community[]
    },
  })
}

export function useCommunity(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...key, 'detail', user?.id, id],
    enabled: !!user && !!id,
    queryFn: async ({ signal }) => {
      const [record, membership, totals] = await Promise.all([
        supabase.from('communities').select(COLUMNS).eq('id', id!).abortSignal(signal).maybeSingle(),
        supabase.from('community_members').select('user_id').eq('community_id', id!).eq('user_id', user!.id).abortSignal(signal).maybeSingle(),
        supabase.from('community_members').select('user_id', { count: 'exact', head: true }).eq('community_id', id!).abortSignal(signal),
      ])
      if (record.error || membership.error || totals.error) throw record.error ?? membership.error ?? totals.error
      if (!record.data) return null
      const { data: host } = await supabase.from('profiles').select(people).eq('id', record.data.owner_id).abortSignal(signal).maybeSingle()
      const community = { ...record.data, member_total: 1 + (totals.count ?? 0) } as Community
      return { ...community, host: host as Profile | null, joined: community.owner_id === user!.id || !!membership.data }
    },
  })
}

export function useCommunityMembers(id?: string) {
  return useInfiniteQuery({
    queryKey: [...key, 'members', id],
    enabled: !!id,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.from('community_members').select('person:profiles!community_members_user_id_fkey(' + people + ')')
        .eq('community_id', id!).order('joined_at').order('user_id').range(pageParam, pageParam + MEMBERS_PER_PAGE - 1).abortSignal(signal)
      if (error) throw error
      return (data as unknown as { person: Profile | null }[]).flatMap(({ person }) => person ? [person] : [])
    },
    getNextPageParam: (lastPage, _allPages, offset) => lastPage.length === MEMBERS_PER_PAGE ? offset + MEMBERS_PER_PAGE : undefined,
  })
}

export function useCommunityMembership(id?: string) {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (join: boolean) => {
      if (!id || !user) throw new Error('Entre novamente para gerenciar sua participação.')
      const { error } = join
        ? await supabase.from('community_members').upsert({ community_id: id, user_id: user.id }, { ignoreDuplicates: true })
        : await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', user.id)
      if (error) throw new Error('Não foi possível atualizar sua participação. Tente novamente.')
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  })
}

export function useSaveCommunity(existing?: Community) {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string; name: string; bio: string; category: ActivityCategory; photo: File | null; keepCover: boolean
    }) => {
      if (!user) throw new Error('Entre novamente para salvar a comunidade.')
      if (existing && existing.owner_id !== user.id) throw new Error('Apenas o dono pode editar a comunidade.')
      const { data, cleanUp } = await withSocialPhotos(user.id, input.id, input.photo ? [input.photo] : [], async (urls) => {
        if (existing) {
          const { data, error } = await supabase.from('communities')
            .update({ name: input.name, bio: input.bio, category: input.category, photo_url: urls[0] ?? (input.keepCover ? existing.photo_url : null) })
            .eq('id', existing.id).eq('owner_id', user.id).select('photo_url').single()
          return { data: data?.photo_url ?? null, error }
        }
        return await supabase.rpc('create_community', {
          draft_id: input.id, community_name: input.name, community_bio: input.bio,
          community_category: input.category, cover_url: urls[0] ?? null,
        })
      })
      await cleanUp(typeof data === 'string' ? [data] : [])
      return input.id
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteCommunity() {
  const { user } = useAuth()
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Entre novamente para excluir a comunidade.')
      const { data, error } = await supabase.from('communities').delete()
        .eq('id', id).eq('owner_id', user.id).select('id, photo_url').maybeSingle()
      if (error || !data) throw new Error('Não foi possível excluir a comunidade. Tente novamente.')

      if (data.photo_url) {
        const bucket = supabase.storage.from('post-media')
        const prefix = user.id + '/' + id + '-'
        const { data: { publicUrl } } = bucket.getPublicUrl(prefix)
        const suffix = data.photo_url.startsWith(publicUrl) ? data.photo_url.slice(publicUrl.length) : ''
        if (/^[0-9a-f-]{36}\.jpg$/i.test(suffix)) await bucket.remove([prefix + suffix]).catch(() => undefined)
      }
    },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: key }) },
  })
}
