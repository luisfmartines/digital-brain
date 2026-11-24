import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

test('Neural imports catalog exercises and saves a routine for an empty account', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  let handler
  let modelCalls = 0
  let googleInsert
  const inserts = new Map()
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init)
    const { hostname, pathname } = new URL(request.url)
    if (hostname === 'generativelanguage.googleapis.com') {
      const body = await request.json()
      if (body.contents.some(({ parts }) => parts.some(({ text }) => text === 'Marque uma reunião'))) {
        return Response.json({ candidates: [{ content: { parts: [{ functionCall: {
          name: 'criar_evento', args: { titulo: 'Reunião', inicio: '2026-11-30T18:00:00-03:00', lembrete_minutos: 10 },
        } }] } }] })
      }
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
    if (hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'short-lived' })
    if (hostname === 'www.googleapis.com') {
      assert.equal(pathname, '/calendar/v3/calendars/primary/events')
      assert.equal(request.headers.get('Authorization'), 'Bearer short-lived')
      googleInsert = await request.json()
      return Response.json({ id: 'google-event-id' })
    }
    assert.equal(hostname, 'supabase.test')
    if (pathname === '/rest/v1/google_tokens') {
      assert.equal(request.headers.get('Authorization'), 'Bearer service-key')
      return Response.json([{ refresh_token: 'refresh-test' }])
    }
    assert.equal(request.headers.get('Authorization'), 'Bearer test-token')
    if (pathname === '/auth/v1/user') return Response.json({ id: userId })
    if (request.method === 'GET') return Response.json([])
    const table = pathname.split('/').pop()
    inserts.set(table, await request.json())
    return Response.json(table === 'workout_routines' ? [{ id: 'routine-id' }] : [])
  })
  globalThis.Deno = {
    env: { get: (key) => ({ SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'test-key', SUPABASE_SERVICE_ROLE_KEY: 'service-key', GEMINI_API_KEY: 'model-key' })[key] },
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

  const calendarResponse = await handler(new Request('https://app.test/neural', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Marque uma reunião' }], tzOffsetMinutes: 180 }),
  }))
  const [event] = (await calendarResponse.json()).actions
  assert.equal(event.badge, 'Google Agenda')
  assert.equal(event.link, '/calendar?view=day&date=2026-11-30')
  assert.equal(googleInsert.summary, 'Reunião')
  assert.equal(googleInsert.start.dateTime, '2026-11-30T21:00:00.000Z')
  assert.deepEqual(googleInsert.reminders.overrides, [{ method: 'popup', minutes: 10 }])
  assert.equal(inserts.has('calendar_events'), false)
})
