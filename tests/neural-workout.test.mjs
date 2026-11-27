import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

test('Neural imports catalog exercises and saves a routine for an empty account', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  let handler
  let modelCalls = 0
  let googleInsert
  const inserts = new Map()
  const taskInserts = []
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init)
    const { hostname, pathname } = new URL(request.url)
    if (hostname === 'generativelanguage.googleapis.com') {
      const body = await request.json()
      const latest = body.contents.at(-1).parts[0].text
      if (latest === 'Crie uma tarefa de reunião e outra de saúde') {
        const task = body.tools[0].functionDeclarations.find(({ name }) => name === 'criar_tarefa')
        assert.ok(task.parameters.required.includes('categoria'))
        assert.deepEqual(task.parameters.properties.categoria.enum, ['work', 'meeting', 'health', 'personal', 'fitness', 'mindset'])
        return Response.json({ candidates: [{ content: { parts: [
          { functionCall: { name: 'criar_tarefa', args: { titulo: 'Preparar reunião', categoria: 'meeting' } } },
          { functionCall: { name: 'criar_tarefa', args: { titulo: 'Marcar exames', categoria: 'health' } } },
        ] } }] })
      }
      if (body.contents.some(({ parts }) => parts.some(({ text }) => text === 'Marque uma reunião'))) {
        return Response.json({ candidates: [{ content: { parts: [{ functionCall: {
          name: 'criar_evento', args: { titulo: 'Reunião', categoria: 'meeting', inicio: '2026-11-30T18:00:00-03:00', lembrete_minutos: 10 },
        } }] } }] })
      }
      const declarations = body.tools[0].functionDeclarations.map(({ name }) => name)
      modelCalls++
      if (latest === 'Monte meu treino de peito e costas') {
        if (declarations.includes('buscar_exercicios')) {
          return Response.json({ candidates: [{ content: { parts: [{ text: 'Posso ajudar a montar.' }] } }] })
        }
        assert.deepEqual(body.toolConfig.functionCallingConfig, { mode: 'ANY', allowedFunctionNames: ['criar_treino'] })
        const options = JSON.parse(body.systemInstruction.parts[0].text.match(/somente para consulta: (.*)/)[1])
        const selected = [
          ...options.filter(({ grupo }) => grupo === 'chest').slice(0, 2),
          ...options.filter(({ grupo }) => grupo === 'back').slice(0, 2),
        ]
        assert.equal(selected.length, 4)
        return Response.json({ candidates: [{ content: { parts: [{ functionCall: {
          name: 'criar_treino', args: {
            nome: 'Peito e costas',
            exercicios: selected.map(({ ref }) => ({ exercicio_id: ref, series: 3, repeticoes: 10 })),
          },
        } }] } }] })
      }
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
    if (pathname === '/auth/v1/user' && request.headers.get('Authorization') !== 'Bearer test-token') {
      return Response.json({ message: 'invalid token' }, { status: 401 })
    }
    assert.equal(request.headers.get('Authorization'), 'Bearer test-token')
    if (pathname === '/auth/v1/user') return Response.json({ id: userId })
    if (request.method === 'GET') return Response.json([])
    const table = pathname.split('/').pop()
    const row = await request.json()
    inserts.set(table, row)
    if (table === 'tasks') {
      taskInserts.push(row)
      return Response.json([{ id: 'task-' + taskInserts.length }])
    }
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

  async function send(text) {
    const response = await handler(new Request('https://app.test/neural', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({ messages: [{ role: 'user', text }] }),
    }))
    assert.equal(response.status, 200)
    return response.json()
  }

  const combined = await send('Monte meu treino de peito e costas')
  assert.equal(combined.reply, 'Treino salvo em Treinos.')
  assert.equal(combined.actions[0].title, 'Peito e costas')
  assert.deepEqual(new Set(inserts.get('exercises').map(({ muscle_group }) => muscle_group)), new Set(['chest', 'back']))
  assert.equal(inserts.get('routine_exercises').length, 4)

  const previousCalls = modelCalls
  const programming = await send('Me dê um código de programação em Python')
  assert.match(programming.reply, /^Posso ajudar com tarefas/)
  assert.deepEqual(programming.actions, [])
  assert.equal(modelCalls, previousCalls)

  const unauthorized = await handler(new Request('https://app.test/neural', {
    method: 'POST',
    headers: { Authorization: 'Bearer invalid-token' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Monte meu treino de peito e costas' }] }),
  }))
  assert.equal(unauthorized.status, 401)
  assert.equal(modelCalls, previousCalls)

  const calendarResponse = await handler(new Request('https://app.test/neural', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify({ messages: [{ role: 'user', text: 'Marque uma reunião' }], tzOffsetMinutes: 180 }),
  }))
  const [event] = (await calendarResponse.json()).actions
  assert.equal(event.badge, 'Google Agenda')
  assert.equal(event.link, '/calendar?view=day&date=2026-11-30')
  assert.equal(googleInsert.summary, 'Reunião')
  assert.equal(googleInsert.extendedProperties.private.digitalBrainCategory, 'meeting')
  assert.equal(googleInsert.start.dateTime, '2026-11-30T21:00:00.000Z')
  assert.deepEqual(googleInsert.reminders.overrides, [{ method: 'popup', minutes: 10 }])
  assert.equal(inserts.has('calendar_events'), false)

  const planning = await send('Crie uma tarefa de reunião e outra de saúde')
  assert.deepEqual(planning.actions.map(({ badge }) => badge), ['Reunião', 'Saúde'])
  assert.deepEqual(taskInserts.map(({ title, category }) => [title, category]), [
    ['Preparar reunião', 'meeting'], ['Marcar exames', 'health'],
  ])
})
