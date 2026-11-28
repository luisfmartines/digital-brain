import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { addDays, startOfWeek } from '../../lib/date'
import type { LogWorkout } from './stats'
import type { HistSession, HistSet } from './exerciseStats'
import { volumeOf, workoutSeconds, type SetLike, type Timing } from './utils'
import { restStorageKey, type SetType } from './setTypes'
import { translateExercise } from '../exercisedb/translate'
import { removeExercisePhoto, uploadExercisePhoto } from '../exercisedb/exercisePhoto'

export interface Exercise { id: string; name: string; muscle_group: string; equipment: string | null; user_id: string | null; photo_path?: string | null }
export const isCustomExercise = (exercise: Exercise, userId?: string) =>
  !!userId && exercise.user_id === userId && !exercise.id.startsWith(userId + ':')
export interface RoutineExercise { id: string; position: number; target_sets: number; rest_seconds: number; exercise: Exercise }
export interface Routine { id: string; name: string; focus: string | null; notes: string | null; tags: string[]; created_at: string; routine_exercises: RoutineExercise[] }
export interface SessionSet extends SetLike { id: string; exercise_id: string; set_number: number; exercise_order: number; set_type?: SetType | null; exercise: Exercise }
export interface Session extends Timing { id: string; name: string; routine_id: string | null; photo_url: string | null; photo_urls?: string[]; workout_sets: SessionSet[] }
export interface PrevSet { exercise_id: string; set_number: number; weight_kg: number | null; reps: number | null; is_warmup: boolean }

// A foto é opcional e pode ainda não existir no esquema do ambiente.
const EX = '*'
const ROUTINE = `id, name, focus, notes, tags, created_at, routine_exercises(id, position, target_sets, rest_seconds, exercise:exercises(${EX}))`
const sortRoutine = (r: Routine): Routine => ({
  ...r,
  routine_exercises: [...(r.routine_exercises ?? [])].map((row) => ({ ...row, exercise: translateExercise(row.exercise) })).sort((a, b) => a.position - b.position),
})

/* ---------- Rotinas e hub ---------- */

export function useRoutines() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'routines', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('workout_routines').select(ROUTINE).is('deleted_at', null).order('created_at')
      if (error) throw error
      return ((data ?? []) as unknown as Routine[]).map(sortRoutine)
    },
  })
}

export function useRoutine(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'routine', id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('workout_routines').select(ROUTINE).eq('id', id!).eq('user_id', user!.id).is('deleted_at', null).single()
      if (error) throw error
      return sortRoutine(data as unknown as Routine)
    },
  })
}

export function useLastPerformed() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'last', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts').select('routine_id, ended_at')
        .eq('user_id', user!.id)
        .not('routine_id', 'is', null).not('ended_at', 'is', null).is('deleted_at', null)
        .order('ended_at', { ascending: false }).limit(200)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const w of (data ?? []) as { routine_id: string; ended_at: string }[]) if (!map[w.routine_id]) map[w.routine_id] = w.ended_at
      return map
    },
  })
}

export function useWeekStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'week', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const thisStart = startOfWeek(new Date())
      const { data, error } = await supabase
        .from('workouts').select('ended_at, workout_sets(weight_kg, reps, completed, is_warmup)')
        .eq('user_id', user!.id)
        .not('ended_at', 'is', null).is('deleted_at', null)
        .gte('ended_at', addDays(thisStart, -7).toISOString())
      if (error) throw error
      let count = 0
      let volume = 0
      let lastVolume = 0
      for (const w of (data ?? []) as { ended_at: string; workout_sets: SetLike[] }[]) {
        const v = volumeOf(w.workout_sets)
        if (new Date(w.ended_at) >= thisStart) { count++; volume += v } else lastVolume += v
      }
      return { count, volume, lastVolume }
    },
  })
}

export interface HistoryItem {
  id: string; name: string; ended_at: string; seconds: number; volume: number; sets: number; category: string | null
}
export function useHistory(weekStart: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'history', user?.id, weekStart],
    enabled: !!user,
    queryFn: async () => {
      const firstDay = new Date(weekStart + 'T00:00:00')
      const { data, error } = await supabase
        .from('workouts')
        .select('id, name, started_at, ended_at, paused_seconds, paused_at, activity_category, workout_sets(weight_kg, reps, completed, is_warmup)')
        .eq('user_id', user!.id)
        .gte('ended_at', firstDay.toISOString()).lt('ended_at', addDays(firstDay, 7).toISOString()).is('deleted_at', null)
        .order('ended_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as (Timing & { id: string; name: string; activity_category: string | null; workout_sets: SetLike[] })[]).map((w): HistoryItem => ({
        id: w.id,
        name: w.name,
        ended_at: w.ended_at!,
        seconds: workoutSeconds(w, 0),
        volume: volumeOf(w.workout_sets),
        category: w.activity_category,
        sets: w.workout_sets.filter((set) => set.completed && !set.is_warmup).length,
      }))
    },
  })
}

export { useActiveWorkout } from './useActiveWorkout'

/* ---------- Exercícios e rotinas (edição) ---------- */

export function useExercises() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'exercises', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select(EX)
        .or(`user_id.is.null,user_id.eq.${user!.id}`).order('name')
      if (error) throw error
      return ((data ?? []) as Exercise[]).map(translateExercise)
    },
  })
}

export function useCreateExercise() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ photo, ...fields }: { name: string; muscle_group: string; photo: File | null }) => {
      if (!user) throw new Error('Entre novamente para criar o exercício.')
      const id = crypto.randomUUID()
      const photoPath = photo ? user.id + '/' + id + '.jpg' : null
      if (photo && photoPath) await uploadExercisePhoto(photoPath, photo)

      const { data, error } = await supabase.from('exercises')
        .insert({ ...fields, id, user_id: user.id, ...(photoPath ? { photo_path: photoPath } : {}) }).select(EX).single()
      if (error) {
        if (photoPath) {
          const { data: saved, error: readError } = await supabase.from('exercises').select(EX).eq('id', id).maybeSingle()
          if (saved) return saved as Exercise
          if (!readError) await removeExercisePhoto(photoPath).catch(() => undefined)
        }
        throw new Error('Não foi possível criar o exercício. Tente novamente.')
      }
      return data as Exercise
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts', 'exercises'] }),
  })
}

export function useEditExercise() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ exercise, name, muscle_group, photo }: {
      exercise: Exercise; name: string; muscle_group: string; photo: File | null
    }) => {
      if (!user || !isCustomExercise(exercise, user.id)) throw new Error('Este exercício não pode ser editado.')
      const path = exercise.photo_path ?? `${user.id}/${exercise.id}.jpg`
      if (photo) await uploadExercisePhoto(path, photo, true)
      const { data, error } = await supabase.from('exercises')
        .update({ name, muscle_group, ...(photo ? { photo_path: path } : {}) })
        .eq('id', exercise.id).eq('user_id', user.id).select(EX).single()
      if (error) throw new Error('Não foi possível salvar o exercício. Tente novamente.')
      return data as Exercise
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['workouts'] }),
      qc.invalidateQueries({ queryKey: ['social', 'workout-detail'] }),
      qc.invalidateQueries({ queryKey: ['exercisedb', 'photo'] }),
    ]),
  })
}

export interface RoutineRow { exercise_id: string; target_sets: number; rest_seconds: number }

export function useSaveRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input, rows }: { id?: string; input: { name: string; focus: string | null; tags: string[] }; rows: RoutineRow[] }) => {
      let rid = id
      if (id) {
        const up = await supabase.from('workout_routines').update(input).eq('id', id)
        if (up.error) throw up.error
        const del = await supabase.from('routine_exercises').delete().eq('routine_id', id)
        if (del.error) throw del.error
      } else {
        const ins = await supabase.from('workout_routines').insert(input).select('id').single()
        if (ins.error) throw ins.error
        rid = ins.data.id as string
      }
      if (rows.length) {
        const { error } = await supabase.from('routine_exercises').insert(rows.map((r, i) => ({ ...r, routine_id: rid, position: i })))
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export function useDeleteRoutine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_routines').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

/* ---------- Sessão de treino ---------- */

export function useStartWorkout() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    // Se já existe um treino em andamento, devolve o dele
    mutationFn: async (routine?: Routine): Promise<string> => {
      if (!user) throw new Error('Entre novamente para iniciar o treino.')
      const active = await supabase.from('workouts').select('id').eq('user_id', user.id)
        .is('ended_at', null).is('deleted_at', null).order('started_at', { ascending: false }).limit(1)
      if (active.error) throw active.error
      if (active.data?.[0]) return active.data[0].id as string

      const created = await supabase
        .from('workouts').insert({ name: routine?.name ?? 'Treino rápido', routine_id: routine?.id ?? null })
        .select('id').single()
      if (created.error) throw created.error
      const wid = created.data.id as string

      if (routine && routine.routine_exercises.length) {
        const prev = await supabase.rpc('previous_sets', { exercise_ids: routine.routine_exercises.map((r) => r.exercise.id) })
        const prevBy = new Map<string, PrevSet[]>()
        for (const p of (prev.data ?? []) as PrevSet[]) {
          if (!p.is_warmup) prevBy.set(p.exercise_id, [...(prevBy.get(p.exercise_id) ?? []), p])
        }
        const rows = routine.routine_exercises.flatMap((r, idx) =>
          Array.from({ length: r.target_sets }, (_, i) => {
            const p = prevBy.get(r.exercise.id)?.[i]
            return {
              workout_id: wid, exercise_id: r.exercise.id, exercise_order: idx, set_number: i + 1,
              weight_kg: p?.weight_kg ?? null, reps: null,
            }
          })
        )
        const ins = await supabase.from('workout_sets').insert(rows)
        if (ins.error) throw ins.error
      }
      return wid
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export const sessionKey = (id?: string, userId?: string) => ['workouts', 'session', id, userId]

export function useSession(id?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: sessionKey(id, user?.id),
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select(`id, name, routine_id, started_at, ended_at, paused_seconds, paused_at, photo_url, photo_urls, workout_sets(*, exercise:exercises(${EX}))`)
        .eq('id', id!).eq('user_id', user!.id).is('deleted_at', null).maybeSingle()
      if (error) throw error
      const session = data as Session | null
      return session ? { ...session, workout_sets: session.workout_sets.map((row) => ({ ...row, exercise: translateExercise(row.exercise) })) } : null
    },
  })
}

export function usePrevious(exerciseIds: string[]) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'previous', user?.id, [...exerciseIds].sort().join(',')],
    enabled: !!user && exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('previous_sets', { exercise_ids: exerciseIds })
      if (error) throw error
      const map = new Map<string, PrevSet[]>()
      for (const p of (data ?? []) as PrevSet[]) map.set(p.exercise_id, [...(map.get(p.exercise_id) ?? []), p])
      return map
    },
  })
}

export function useSessionActions(id: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = sessionKey(id, user?.id)
  const scope = { id: `workout-session:${id}` }
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const patchSet = (setId: string, patch: Partial<SessionSet>) =>
    qc.setQueryData<Session | null>(key, (old) =>
      old ? { ...old, workout_sets: old.workout_sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : old
    )

  const updateSet = useMutation({
    scope,
    mutationFn: async ({ setId, patch }: { setId: string; patch: Pick<Partial<SessionSet>, 'weight_kg' | 'reps' | 'completed' | 'is_warmup' | 'set_type'> }) => {
      const { error } = await supabase.from('workout_sets').update(patch).eq('id', setId).eq('workout_id', id).select('id').single()
      if (error) throw error
    },
    onMutate: ({ setId, patch }) => { patchSet(setId, patch) },
    onError: refresh,
  })

  const addSet = useMutation({
    scope,
    mutationFn: async (v: { exerciseId: string; order: number; setNumber: number; weight: number | null }) => {
      const { error } = await supabase.from('workout_sets').insert({
        workout_id: id, exercise_id: v.exerciseId, exercise_order: v.order, set_number: v.setNumber, weight_kg: v.weight, reps: null,
      })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const removeSet = useMutation({
    scope,
    mutationFn: async (setId: string) => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', setId)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const addExercise = useMutation({
    scope,
    mutationFn: async ({ exerciseId, order }: { exerciseId: string; order: number }) => {
      const rows = [1, 2, 3].map((n) => ({ workout_id: id, exercise_id: exerciseId, exercise_order: order, set_number: n, reps: null }))
      const { error } = await supabase.from('workout_sets').insert(rows)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const replaceExercise = useMutation({
    scope,
    mutationFn: async ({ exerciseId, replacementId, order }: { exerciseId: string; replacementId: string; order: number }) => {
      const { error } = await supabase.from('workout_sets')
        .update({ exercise_id: replacementId, weight_kg: null, reps: null, completed: false })
        .eq('workout_id', id).eq('exercise_order', order).eq('exercise_id', exerciseId)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const removeExercise = useMutation({
    scope,
    mutationFn: async ({ exerciseId, order }: { exerciseId: string; order: number }) => {
      const { error } = await supabase.from('workout_sets').delete().eq('workout_id', id).eq('exercise_order', order).eq('exercise_id', exerciseId)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const pause = useMutation({
    scope,
    mutationFn: async (w: Session) => {
      const patch = w.paused_at
        ? { paused_seconds: w.paused_seconds + Math.floor((Date.now() - new Date(w.paused_at).getTime()) / 1000), paused_at: null }
        : { paused_at: new Date().toISOString() }
      const { error } = await supabase.from('workouts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const discard = useMutation({
    scope,
    mutationFn: async () => {
      const { error } = await supabase.from('workouts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })

  return { updateSet, addSet, removeSet, addExercise, replaceExercise, removeExercise, pause, discard }
}

/* ---------- Resumo do treino ---------- */

export function useSummaryExtras(session?: Session | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'summary', user?.id, session?.id, session?.ended_at],
    enabled: !!user && !!session?.ended_at,
    queryFn: async () => {
      const s = session!
      const ids = [...new Set(s.workout_sets.map((x) => x.exercise_id))]
      const bests = await supabase.rpc('exercise_bests', { exercise_ids: ids, before_ts: s.started_at })
      const xp = await supabase.from('xp_events').select('amount').eq('ref_id', s.id).eq('source', 'workout').maybeSingle()
      let prevVolume: number | null = null
      if (s.routine_id) {
        const prev = await supabase
          .from('workouts').select('id, workout_sets(weight_kg, reps, completed, is_warmup)')
          .eq('user_id', user!.id)
          .eq('routine_id', s.routine_id).neq('id', s.id).lt('ended_at', s.ended_at!).is('deleted_at', null)
          .order('ended_at', { ascending: false }).limit(1)
        const row = (prev.data ?? [])[0] as { workout_sets: SetLike[] } | undefined
        if (row) prevVolume = volumeOf(row.workout_sets)
      }
      const map = new Map<string, number>()
      for (const b of (bests.data ?? []) as { exercise_id: string; best_weight: number }[]) map.set(b.exercise_id, Number(b.best_weight))
      return { bests: map, xp: (xp.data?.amount ?? null) as number | null, prevVolume }
    },
  })
}

export function useFinalizeWorkout(workoutId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `workout-session:${workoutId}` },
    mutationFn: async ({ photos, updateRoutine }: { photos: Blob[]; updateRoutine: boolean }) => {
      if (!user) throw new Error('Entre novamente para finalizar o treino.')
      const bucket = supabase.storage.from('post-media')
      const uploads = await Promise.allSettled(photos.map(async (photo) => {
        const path = `${user.id}/${workoutId}-${crypto.randomUUID()}.jpg`
        const { error } = await bucket.upload(path, photo, { contentType: 'image/jpeg' })
        if (error) throw error
        return { path, url: bucket.getPublicUrl(path).data.publicUrl }
      }))
      const uploaded = uploads.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      const removeUploads = async (published: string[] = []) => {
        const unused = uploaded.filter(({ url }) => !published.includes(url)).map(({ path }) => path)
        if (unused.length) await bucket.remove(unused).catch(() => undefined)
      }
      if (uploaded.length !== photos.length) {
        await removeUploads()
        throw new Error('Não foi possível enviar todas as fotos. Tente finalizar novamente.')
      }
      const { data, error } = await supabase.rpc('finish_workout_with_photos', {
        session_id: workoutId,
        update_routine: updateRoutine,
        selected_photos: uploaded.map(({ url }) => url),
      })
      if (error) {
        if (/^[0-9A-Z]{5}$/.test(error.code) || error.code === 'PGRST202') await removeUploads()
        if (error.code === '23514') throw new Error('Ainda há séries pendentes. Volte ao treino e conclua as séries.')
        throw new Error('Não foi possível finalizar o treino. Tente novamente.')
      }
      if (Array.isArray(data)) await removeUploads(data)
    },
    onSuccess: () => {
      try { localStorage.removeItem(restStorageKey(workoutId)) } catch { /* Optional storage. */ }
      const refresh = qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['home'] })
      qc.invalidateQueries({ queryKey: ['social'] })
      return refresh
    },
  })
}

export function useRemoveFinishedWorkoutPhoto(workoutId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `workout-session:${workoutId}` },
    mutationFn: async (photoUrl: string) => {
      if (!user) throw new Error('Entre novamente para remover a foto.')
      const { data: removed, error } = await supabase.rpc('remove_finished_workout_photo', {
        session_id: workoutId,
        photo_url_to_remove: photoUrl,
      })
      if (error) throw new Error('Não foi possível remover a foto. Tente novamente.')

      const bucket = supabase.storage.from('post-media')
      const prefix = `${user.id}/${workoutId}-`
      const publicPrefix = bucket.getPublicUrl(prefix).data.publicUrl
      const suffix = photoUrl.slice(publicPrefix.length)
      if (removed === true && photoUrl.startsWith(publicPrefix) && /^[0-9a-f-]+\.jpg$/i.test(suffix)) {
        await bucket.remove([prefix + suffix]).catch(() => undefined)
      }
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: sessionKey(workoutId, user?.id) }),
      qc.invalidateQueries({ queryKey: ['social'] }),
    ]),
  })
}

/* ---------- Estatísticas e logbook ---------- */

export type RoutineHistorySet = Pick<SessionSet, 'id' | 'exercise_id' | 'set_number' | 'set_type' | 'weight_kg' | 'reps' | 'completed' | 'is_warmup'>
export interface RoutineHistoryWorkout {
  id: string
  started_at: string
  ended_at: string
  paused_seconds: number
  workout_sets: RoutineHistorySet[]
}

export function useRoutineHistory(routineId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'routine-history', user?.id, routineId],
    enabled: !!user && !!routineId,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('workouts')
        .select('id, started_at, ended_at, paused_seconds, workout_sets(id, exercise_id, set_number, set_type, weight_kg, reps, completed, is_warmup)')
        .eq('user_id', user!.id).eq('routine_id', routineId!).not('ended_at', 'is', null).is('deleted_at', null)
        .order('ended_at', { ascending: false }).limit(120).abortSignal(signal)
      if (error) throw error
      return (data ?? []) as RoutineHistoryWorkout[]
    },
  })
}

export function useWorkoutLog() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'log', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id, name, started_at, ended_at, paused_seconds, activity_category, distance_km, workout_sets(weight_kg, reps, completed, is_warmup, exercise:exercises(name, muscle_group))')
        .eq('user_id', user!.id)
        .not('ended_at', 'is', null).is('deleted_at', null)
        .order('ended_at', { ascending: false }).limit(1000)
      if (error) throw error
      return ((data ?? []) as unknown as LogWorkout[]).map((workout) => ({ ...workout, workout_sets: workout.workout_sets.map((set) => ({ ...set, exercise: set.exercise ? translateExercise(set.exercise) : null })) }))
    },
  })
}

/* ---------- Histórico de um exercício ---------- */

export function useExerciseHistory(exerciseId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workouts', 'exercise-history', user?.id, exerciseId],
    enabled: !!user && !!exerciseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, workout:workouts(id, name, ended_at, deleted_at)')
        .eq('user_id', user!.id).eq('exercise_id', exerciseId!).eq('completed', true)
        .limit(3000)
      if (error) throw error
      type Row = HistSet & { workout: { id: string; name: string; ended_at: string | null; deleted_at: string | null } | null }
      const by = new Map<string, HistSession>()
      for (const r of (data ?? []) as unknown as Row[]) {
        const w = r.workout
        if (!w || !w.ended_at || w.deleted_at) continue
        const cur = by.get(w.id) ?? { id: w.id, name: w.name, at: new Date(w.ended_at), sets: [] }
        cur.sets.push({ id: r.id, set_number: r.set_number, weight_kg: r.weight_kg, reps: r.reps, is_warmup: r.is_warmup, set_type: r.set_type })
        by.set(w.id, cur)
      }
      // Do mais antigo para o mais recente
      return [...by.values()]
        .map((s) => ({ ...s, sets: s.sets.sort((a, b) => a.set_number - b.set_number) }))
        .sort((a, b) => a.at.getTime() - b.at.getTime())
    },
  })
}
