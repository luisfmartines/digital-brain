import snapshot from './locales/catalog-search.json' with { type: 'json' }
import { CATALOG_MUSCLES, exerciseGroup, normalize } from './api.ts'
import { catalogSearchEquipment, catalogSearchNames, prepareExerciseSearch, rankExercises } from './search.ts'

const catalogue = snapshot.map((row) => {
  const exercise = normalize(row)
  return prepareExerciseSearch({
    item: { exercise, targets: exercise.targets.map((target) => target.toLowerCase()), muscle: exerciseGroup(exercise) },
    names: catalogSearchNames(exercise),
    equipment: catalogSearchEquipment(exercise),
  })
})

export function searchCatalogue(term: string, muscle: string, start: number, limit: number) {
  const targets = new Set(CATALOG_MUSCLES[muscle]?.split(','))
  const entries = muscle ? catalogue.filter(({ item }) =>
    item.muscle === muscle || item.targets.some((target) => targets.has(target))) : catalogue
  const matches = rankExercises(entries, term)
  const end = start + limit
  return {
    exercises: matches.slice(start, end).map(({ exercise }) => exercise),
    nextOffset: end < matches.length ? end : null,
  }
}
