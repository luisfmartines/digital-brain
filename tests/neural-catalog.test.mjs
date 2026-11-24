import assert from 'node:assert/strict'
import test from 'node:test'
import { findExercises } from '../supabase/functions/neural/exerciseSearch.ts'

test('Neural finds catalog exercises for users with no saved exercises', () => {
  const items = findExercises('user', [], { grupos: ['chest'], equipamentos: ['dumbbell'], busca: 'supino reto' })
  assert.ok(items.length >= 3)
  assert.equal(items[0].name, 'Supino reto com halteres')
  assert.ok(items.every(({ id, external_id, muscle_group, equipment }) =>
    id === `user:${external_id}` && muscle_group === 'chest' && equipment === 'dumbbell'))
})

test('Neural respects equipment restrictions and reuses previously imported exercises', () => {
  const matches = findExercises('user', [], { grupos: ['back'], equipamentos: ['band'] })
  assert.ok(matches.length >= 3)
  assert.ok(matches.every(({ equipment }) => equipment === 'resistance band'))
  const { external_id, ...saved } = matches[0]
  const reused = findExercises('user', [saved], { grupos: ['back'], equipamentos: ['resistance band'], busca: saved.name })
  assert.deepEqual(reused.filter(({ id }) => id === saved.id).map((exercise) => exercise.external_id), [external_id])
})
