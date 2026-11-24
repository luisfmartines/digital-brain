import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

test('Neural imports catalog exercises and saves a routine for an empty account', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  let handler
  let modelCalls = 0
  const inserts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init)
    const { hostname, pathname } = new URL(request.url)
    if (hostname === 'generativelanguage.googleapis.com') {
      const body = await request.json()
      const declarations = body.tools[0].functionDeclarations.map(({ name }) => name)
      modelCalls++
      if (modelCalls === 1) {
        assert.ok(declarations.includes('buscar_exercicios'))
        assert.ok(!declarations.includes('criar_treino'))
        return Response.json({ candidates: [{ content: { parts: [{ functionCall: {
          name: 'buscar_exercicios', args: { grupos: ['chest'], equipamentos: ['dumbbell'], busca: 'supino reto' },
        } }] } }] })
      }
      assert.deepEqual(declarations, ['criar_treino'])
      const instructions = body.systemInstruction.parts[0].text
      assert.match(instructions, /Supino reto com halteres/)
      assert.ok(!instructions.includes(userId))
      return Response.json({ candidates: [{ content: { parts: [{ functionCall: {
        name: 'criar_treino', args: { nome: 'Peitoral com halteres', exercicios: ['1', '2', '3'].map((ref) => ({
          exercicio_id: ref, series: 3, repeticoes: 12,
        })) },
      } }] } }] })
    }
    assert.equal(hostname, 'supabase.test')
    assert.equal(request.headers.get('Authorization'), 'Bearer test-token')
    if (pathname === '/auth/v1/user') return Response.json({ id: userId })
    if (request.method === 'GET') return Response.json([])
    const table = pathname.split('/').pop()
    inserts.set(table, await request.json())
    return Response.json(table === 'workout_routines' ? [{ id: 'routine-id' }] : [])
  })
  globalThis.Deno = {
    env: { get: (key) => ({ SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'test-key', GEMINI_API_KEY: 'model-key' })[key] },
    serve: (callback) => { handler = callback },
  }
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return next(specifier === 'npm:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context)
    },
  })
  t.after(() => {
    hooks.deregister()
    delete globalThis.Deno
  })
  await import('../supabase/functions/neural/index.ts')

  const response = await handler(new Request('https://app.test/neural', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Monte um treino de peito com halteres' }] }),
  }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).actions[0].kind, 'routine')
  assert.equal(modelCalls, 2)
  assert.ok(inserts.get('routine_exercises').every((row) => row.target_reps === 12))
  const exercises = inserts.get('exercises')
  assert.equal(exercises.length, 3)
  assert.ok(exercises.every(({ id, user_id }) => id.startsWith(userId + ':') && user_id === userId))
  assert.deepEqual(inserts.get('exercise_media_links').map(({ exercise_id }) => exercise_id), exercises.map(({ id }) => id))
  assert.deepEqual(inserts.get('routine_exercises').map(({ exercise_id }) => exercise_id), exercises.map(({ id }) => id))
})
