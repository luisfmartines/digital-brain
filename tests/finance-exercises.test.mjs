import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totals, monthRange, dailyPace, buildSummary } from '../src/features/finance/summary.ts'
import { exerciseGroup, getExercise, listExercises, searchExercises, suggestQuery } from '../src/features/exercisedb/api.ts'
import { records, metricValue } from '../src/features/workouts/exerciseStats.ts'
import { parseSetCount } from '../src/features/workouts/routineInput.ts'

test('salary is not counted twice and cents remain exact', () => {
  assert.deepEqual(totals(1000, [
    { type: 'income', kind: 'salary', amount: 1000 },
    { type: 'income', kind: 'extra', amount: 0.3 },
    { type: 'expense', kind: 'other', amount: 0.1 },
    { type: 'expense', kind: 'other', amount: 0.2 },
  ]), { extra: 0.3, spent: 0.3, margin: 1000 })
})

test('month boundaries and daily pace handle December and leap years', () => {
  assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2027-01-01' })
  assert.equal(dailyPace(200, '2024-02', new Date(2024, 1, 28)), 100)
  assert.equal(dailyPace(200, '2024-01', new Date(2024, 1, 28)), null)
  assert.equal(dailyPace(-200, '2024-02', new Date(2024, 1, 28)), 0)
})

test('expense categories still compose the total with database-compatible kinds', () => {
  const summary = buildSummary(100, [
    { type: 'expense', kind: 'other', category: 'food', amount: 30 },
    { type: 'expense', kind: 'fixed', category: 'housing', amount: 50 },
    { type: 'expense', kind: 'leisure', category: 'leisure', amount: 40 },
  ])
  assert.deepEqual(summary.groups, { fixed: 50, variable: 30, leisure: 40 })
  assert.equal(summary.margin, -20)
  assert.equal(summary.freePct, 0)
})

test('exercise search uses the public search endpoint and handles results', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(new URL(url).pathname, '/api/v1/exercises/search')
    assert.equal(new URL(url).searchParams.get('search'), 'bench press')
    return Response.json({ success: true, data: [{ exerciseId: 'abc', name: 'Bench', gifUrl: 'https://example.com/a.gif' }] })
  })
  const result = await searchExercises(' bench press ')
  assert.equal(result[0].id, 'abc')
  assert.equal(result[0].imageUrl, 'https://example.com/a.gif')
  assert.deepEqual(await searchExercises('a'), [])
  assert.equal(suggestQuery('Supino inclinado com halter'), 'incline dumbbell bench press')
})

test('exercise details normalize muscles and instructions', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: {
    exerciseId: 'abc', name: 'Bench', targetMuscles: ['pectorals'],
    secondaryMuscles: ['triceps'], instructions: ['First step'],
  } }))
  const result = await getExercise('abc')
  assert.deepEqual(result.targets, ['pectorals'])
  assert.deepEqual(result.instructions, ['First step'])
})

test('API failures are errors, not empty search or empty exercise screens', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429 }))
  await assert.rejects(searchExercises('bench'), /Limite/)
  fetch.mock.mockImplementation(async () => Response.json({ success: false }))
  await assert.rejects(searchExercises('bench'), /consulta/)
  fetch.mock.mockImplementation(async () => Response.json({ data: null }))
  await assert.rejects(getExercise('missing'), /não encontrado/)
  await assert.rejects(searchExercises('bench'), /inválida/)
})

test('exercise records exclude warm-ups and sum working sets', () => {
  const session = { sets: [
    { weight_kg: 200, reps: 20, is_warmup: true },
    { weight_kg: 40, reps: 10, is_warmup: false },
    { weight_kg: 50, reps: 5, is_warmup: false },
  ] }
  assert.equal(metricValue(session, 'volume'), 650)
  assert.equal(records([session]).maxWeight, 50)
  assert.equal(records([session]).maxReps, 10)
  assert.equal(records([]).maxWeight, null)
})

test('picker loads a catalogue without requiring a search and follows cursor pagination', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(new URL(url))
    return Response.json({ data: [{ exerciseId: 'first', name: 'Bench' }], meta: { hasNextPage: true, nextCursor: 'next' } })
  })
  const page = await listExercises()
  assert.equal(page.exercises.length, 1)
  assert.equal(page.nextCursor, 'next')
  assert.equal(requests[0].pathname, '/api/v1/exercises')
  assert.equal(requests[0].searchParams.has('name'), false)
  await listExercises('supino', 'chest', page.nextCursor)
  assert.equal(requests[1].searchParams.get('name'), 'bench press')
  assert.equal(requests[1].searchParams.get('targetMuscles'), 'pectorals')
  assert.equal(requests[1].searchParams.get('after'), 'next')
})

test('catalogue muscle names map to local routine filters', () => {
  assert.equal(exerciseGroup({ targets: ['quadriceps'], bodyParts: ['upper legs'] }), 'quads')
  assert.equal(exerciseGroup({ targets: ['deltoids'], bodyParts: ['shoulders'] }), 'shoulders')
  assert.equal(exerciseGroup({ targets: ['abdominals'], bodyParts: ['waist'] }), 'core')
})

test('sets accept replacement values without coercing empty, fractional or oversized input', () => {
  assert.equal(parseSetCount(''), null)
  assert.equal(parseSetCount('4'), 4)
  assert.equal(parseSetCount('1'), 1)
  assert.equal(parseSetCount('10'), 10)
  for (const invalid of ['14', '0', '-1', '2.5', 'abc', 'Infinity']) {
    assert.equal(parseSetCount(invalid), null)
  }
})
