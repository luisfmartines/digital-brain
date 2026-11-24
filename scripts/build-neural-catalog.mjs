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
const target = new URL('../supabase/functions/neural/exercise-catalog.json', import.meta.url)
await writeFile(target, '[\n' + catalog.map((exercise) => '  ' + JSON.stringify(exercise)).join(',\n') + '\n]\n')
