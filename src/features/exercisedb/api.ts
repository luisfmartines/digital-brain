
import type { ExerciseMedia } from './types'
import { originalSearchTerm, translateName, translateText } from './translate'

const API_URL = (
  import.meta.env?.VITE_EXERCISEDB_URL ||
  'https://oss.exercisedb.dev/api/v1'
).replace(/\/+$/, '')

type Raw = Record<string, unknown>

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : null

const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === 'string' && item.trim() !== ''
      )
    : str(value)
      ? [str(value)!]
      : []

export function normalize(r: Raw): ExerciseMedia {
  return {
    id: String(r.exerciseId ?? r.id ?? ''),
    name: translateName(str(r.name) ?? 'Exercício'),
    originalName: str(r.name) ?? undefined,
    originalInstructions: list(r.instructions),
    videoUrl: str(r.videoUrl),
    imageUrl: str(r.gifUrl) ?? str(r.imageUrl),
    targets: list(r.targetMuscles ?? r.target),
    secondary: list(r.secondaryMuscles),
    equipments: list(r.equipments ?? r.equipment),
    bodyParts: list(r.bodyParts ?? r.bodyPart),
    overview: str(r.overview) ? translateText(str(r.overview)!) : null,
    instructions: list(r.instructions).map(translateText),
    tips: list(r.exerciseTips).map(translateText),
    variations: list(r.variations).map(translateText),
  }
}

async function request(path: string): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(15000) })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Exercício não encontrado')
    }

    if (response.status === 429) {
      throw new Error('Limite de requisições da ExerciseDB atingido')
    }

    throw new Error(`ExerciseDB: erro ${response.status}`)
  }

  const result: unknown = await response.json()
  if (result && typeof result === 'object' && 'success' in result && result.success === false) {
    throw new Error('A ExerciseDB não conseguiu atender esta consulta. Tente novamente.')
  }
  return result
}

function unwrapList(response: unknown): Raw[] {
  const result = response as Raw

  const candidates = [
    result,
    result?.data,
    (result?.data as Raw | undefined)?.exercises,
    result?.exercises,
  ]

  const found = candidates.find(Array.isArray)

  if (!found) throw new Error('Resposta inválida da ExerciseDB')
  return found.filter((item): item is Raw => !!item && typeof item === 'object')
}

export async function searchExercises(
  term: string
): Promise<ExerciseMedia[]> {
  const search = term.trim()

  if (search.length < 2) return []

  const params = new URLSearchParams({
    search,
  })

  const response = await request(
    `/exercises/search?${params.toString()}`
  )

  return unwrapList(response)
    .map(normalize)
    .filter((exercise) => exercise.id)
}

export async function getExercise(
  id: string
): Promise<ExerciseMedia> {
  const response = await request(
    `/exercises/${encodeURIComponent(id)}`
  )

  const result = response as Raw
  const exercise = (result?.data ?? result) as Raw

  if (!exercise || typeof exercise !== 'object' || !(exercise.exerciseId ?? exercise.id)) {
    throw new Error('Exercício não encontrado')
  }
  return normalize(exercise)
}

export const CATALOG_MUSCLES: Record<string, string> = {
  chest: 'pectorals', back: 'lats,upper back,erector spinae,trapezius', shoulders: 'deltoids',
  biceps: 'biceps', triceps: 'triceps', quads: 'quadriceps', hamstrings: 'hamstrings',
  glutes: 'glutes', calves: 'calves', core: 'abdominals,obliques',
}

export function exerciseGroup(exercise: ExerciseMedia) {
  return Object.entries(CATALOG_MUSCLES).find(([, targets]) =>
    exercise.targets.some((target) => targets.split(',').includes(target.toLowerCase())),
  )?.[0] ?? exercise.bodyParts[0] ?? 'other'
}

export async function listExercises(term = '', muscle = '', after?: string) {
  const params = new URLSearchParams({ limit: '25' })
  if (term.trim()) params.set('name', suggestQuery(term.trim()))
  if (CATALOG_MUSCLES[muscle]) params.set('targetMuscles', CATALOG_MUSCLES[muscle])
  if (after) params.set('after', after)
  const response = await request(`/exercises?${params}`) as Raw
  const meta = response?.meta as Raw | undefined
  return {
    exercises: unwrapList(response).map(normalize).filter((exercise) => exercise.id),
    nextCursor: meta?.hasNextPage ? str(meta.nextCursor) : null,
  }
}

/* Tradução de nomes em português para pesquisas em inglês */

const PT_EN: [string, string][] = [
  ['barra fixa', 'pull up'],
  ['puxada', 'pulldown'],
  ['supino', 'bench press'],
  ['remada', 'row'],
  ['rosca', 'curl'],
  ['agachamento', 'squat'],
  ['levantamento terra', 'deadlift'],
  ['elevação lateral', 'lateral raise'],
  ['elevacao lateral', 'lateral raise'],
  ['desenvolvimento', 'shoulder press'],
  ['crucifixo', 'fly'],
  ['flexão', 'push up'],
  ['flexao', 'push up'],
  ['abdominal', 'crunch'],
  ['panturrilha', 'calf raise'],
  ['leg press', 'leg press'],
  ['cadeira extensora', 'leg extension'],
  ['mesa flexora', 'leg curl'],
  ['stiff', 'romanian deadlift'],
  ['afundo', 'lunge'],
  ['prancha', 'plank'],
  ['face pull', 'face pull'],
  ['tríceps', 'triceps'],
  ['triceps', 'triceps'],
  ['halter', 'dumbbell'],
  ['barra', 'barbell'],
  ['cabo', 'cable'],
  ['máquina', 'machine'],
  ['maquina', 'machine'],
  ['inclinado', 'incline'],
  ['declinado', 'decline'],
  ['martelo', 'hammer'],
  ['sentado', 'seated'],
  ['unilateral', 'single arm'],
]

export function suggestQuery(name: string) {
  const original = originalSearchTerm(name)
  if (original) return original
  let query = name.toLowerCase().replace(/[()]/g, ' ')
  const output: string[] = []

  for (const [pt, en] of PT_EN) {
    if (query.includes(pt)) {
      output.push(en)
      query = query.replace(pt, ' ')
    }
  }

  return (output.length ? output.reverse() : [name])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MUSCLE_PT: Record<string, string> = {
  lats: 'Dorsais',
  'upper back': 'Costas superiores',
  traps: 'Trapézio',
  spine: 'Coluna',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  pectorals: 'Peitoral',
  delts: 'Deltoides',
  deltoids: 'Deltoides',
  'serratus anterior': 'Serrátil',
  abs: 'Abdômen',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  glutes: 'Glúteos',
  calves: 'Panturrilhas',
  abductors: 'Abdutores',
  adductors: 'Adutores',
  'levator scapulae': 'Elevador da escápula',
  'cardiovascular system': 'Cardio',
}

export const muscleName = (muscle: string) =>
  MUSCLE_PT[muscle.toLowerCase()] ?? translateText(muscle)
