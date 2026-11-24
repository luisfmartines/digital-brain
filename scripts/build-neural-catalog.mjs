import { writeFile } from 'node:fs/promises'
import snapshot from '../src/features/exercisedb/locales/catalog-source.json' with { type: 'json' }
import { exerciseGroup, normalize } from '../src/features/exercisedb/api.ts'

const catalog = snapshot.map((raw) => {
  const exercise = normalize(raw)
  return {
    external_id: exercise.id,
    name: exercise.name,
    original: exercise.originalName,
    muscle_group: exerciseGroup(exercise),
    equipment: exercise.equipments.join(', ') || null,
  }
})
const pickerCatalog = snapshot.map(({ exerciseId, name, gifUrl, bodyParts, targetMuscles, equipments }) => ({
  exerciseId, name, gifUrl, bodyParts, targetMuscles, equipments,
}))

const writeCatalog = (path, items) =>
  writeFile(new URL(path, import.meta.url), '[\n' + items.map((exercise) => '  ' + JSON.stringify(exercise)).join(',\n') + '\n]\n')

await Promise.all([
  writeCatalog('../supabase/functions/neural/exercise-catalog.json', catalog),
  writeCatalog('../src/features/exercisedb/locales/catalog-search.json', pickerCatalog),
])
