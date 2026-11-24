import type { ExerciseMedia } from './types.ts'
import { translateText } from './translate.ts'

const ignoredWords = new Set(['a', 'as', 'com', 'd', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'the', 'on', 'of', 'with'])

const words = (value: string) => value.normalize('NFD').toLowerCase()
  .replace(/\p{M}/gu, '')
  .split(/[^a-z0-9]+/)
  .filter((word) => word && !ignoredWords.has(word))

const aliases: Record<string, string[]> = {
  'machine seated leg curl': ['flexora sentada', 'flexão de perna sentada', 'leg curl sentado'],
  'machine lying leg curl': ['flexora deitada', 'flexão de perna deitada', 'leg curl deitado'],
  'machine leg extension': ['extensora de pernas', 'extensão de joelhos na máquina'],
  'barbell romanian deadlift': ['rdl com barra', 'terra romeno com barra'],
  'dumbbell romanian deadlift': ['rdl com halteres', 'terra romeno com halteres'],
  'cable crossover': ['crossover na polia', 'cruzamento na polia'],
  'cable pushdown (with rope attachment)': ['tríceps com corda'],
  'dumbbell single leg split squat': ['afundo búlgaro com halteres'],
  'smith single leg split squat': ['afundo búlgaro no Smith'],
  'cable lateral pulldown with v-bar': ['puxada pegada neutra', 'puxada com barra V'],
  'walking lunge': ['afundo andando', 'afundo em caminhada'],
  'seated straight bench press': ['supino vertical', 'supino reto sentado'],
  'machine chest press': ['supino máquina', 'chest press', 'supino vertical', 'supino reto sentado na máquina'],
  'sled 45° leg press': ['leg 45', 'leg press inclinado'],
}

export function catalogSearchNames(exercise: ExerciseMedia) {
  const original = exercise.originalName ?? ''
  return [exercise.name, original, ...(aliases[original.toLowerCase()] ?? [])]
}

export function catalogSearchEquipment(exercise: ExerciseMedia) {
  return exercise.equipments.flatMap((equipment) => [equipment, translateText(equipment)])
}

interface Searchable<T> {
  item: T
  names: string[]
  equipment?: string[]
}

export function prepareExerciseSearch<T>({ item, names, equipment = [] }: Searchable<T>) {
  return { item, names: names.map(words).filter((name) => name.length > 0), equipment: equipment.flatMap(words) }
}

type IndexedExercise<T> = ReturnType<typeof prepareExerciseSearch<T>>

// Allow one typo or swapped adjacent letters in longer words.
function oneEditApart(typed: string, word: string) {
  if (typed.length < 4 || Math.abs(typed.length - word.length) > 1) return false
  const firstDiff = [...typed].findIndex((char, index) => char !== word[index])
  if (firstDiff < 0) return word.length === typed.length + 1
  const typedTail = typed.slice(firstDiff)
  const wordTail = word.slice(firstDiff)
  if (typed.length < word.length) return typedTail === wordTail.slice(1)
  if (typed.length > word.length) return typedTail.slice(1) === wordTail
  return typedTail.slice(1) === wordTail.slice(1) ||
    (typedTail[0] === wordTail[1] && typedTail[1] === wordTail[0] && typedTail.slice(2) === wordTail.slice(2))
}

function matchWord(typed: string, word: string) {
  if (typed === word) return 3
  if (word.startsWith(typed) && typed.length >= 2) return 2
  if (oneEditApart(typed, word)) return 1
  return 0
}

function nameScore(query: string[], typed: string, name: string[], equipment: string[]) {
  const phrase = name.join(' ')
  if (phrase === typed) return 1000
  const exactStart = phrase.startsWith(typed + ' ')
  if (exactStart) return 900 - Math.min(name.length, 25)

  let points = 0
  let weakest = 3
  for (const token of query) {
    const bestInName = name.reduce((best, word) => Math.max(best, matchWord(token, word)), 0)
    const bestInEquipment = equipment.reduce((best, word) => Math.max(best, matchWord(token, word)), 0)
    const best = Math.max(bestInName * 2, bestInEquipment)
    if (!best) return 0
    points += best
    weakest = Math.min(weakest, best / 2)
  }
  const adjacent = name.some((_, start) =>
    query.every((token, index) => name[start + index] && matchWord(token, name[start + index]) >= 2))
  return 100 + weakest * 100 + 10 * points / query.length + (adjacent ? 40 : 0) +
    (matchWord(query[0], name[0]) >= 2 ? 10 : 0) - Math.min(name.length, 25)
}

export function rankExercises<T>(entries: IndexedExercise<T>[], term: string): T[] {
  const query = [...new Set(words(term))]
  const typed = query.join(' ')
  if (!query.length) return entries.map(({ item }) => item)
  return entries.map(({ item, names, equipment }) => ({
    item,
    score: names.reduce((best, name, index) => {
      const score = nameScore(query, typed, name, equipment)
      return Math.max(best, score ? score - (index ? 3 : 0) : 0)
    }, 0),
  })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ item }) => item)
}
