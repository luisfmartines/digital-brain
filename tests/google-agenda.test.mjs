import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

test('Google agenda imports custom calendars, and exports local plans without duplicates', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const taskId = '33333333-3333-4333-8333-333333333333'
  const sent = new Map()
  const selected = []
  const edited = []
  globalThis.Deno = { env: { get: (key) => ({
    SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  })[key] } }
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return next(specifier === 'npm:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context)
    },
  })
  t.after(() => { hooks.deregister(); delete globalThis.Deno })
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.hostname === 'supabase.test') {
      assert.equal(url.searchParams.get('user_id'), `eq.${userId}`)
      if (url.pathname.endsWith('/google_tokens')) return Response.json([{ refresh_token: 'refresh-test' }])
      if (url.pathname.endsWith('/tasks')) return Response.json([{ id: taskId, title: 'Trabalhar', notes: 'Revisar pauta',
        due_at: '2026-11-24T22:00:00.000Z', category: 'work', priority: 'high', remind_minutes_before: 10 }])
      return Response.json([])
    }
    if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'access-test' })
    assert.equal(request.headers.get('authorization'), 'Bearer access-test')
    if (url.pathname.endsWith('/calendarList')) {
      assert.equal(url.searchParams.get('minAccessRole'), 'owner')
      assert.equal(url.searchParams.get('showDeleted'), 'false')
      assert.equal(url.searchParams.get('showHidden'), 'false')
      return Response.json(url.searchParams.has('pageToken')
        ? { items: [{ id: 'meals@example.test', summaryOverride: 'Refeições', accessRole: 'owner', backgroundColor: '#00aa00' },
          { id: 'senac', summary: 'Senac - curso', accessRole: 'owner', deleted: true },
          { id: 'rotinas', summary: 'Rotinas', accessRole: 'owner', hidden: true },
          { id: 'shared', summary: 'Outra conta', accessRole: 'writer' }] }
        : { items: [{ id: 'primary', primary: true, accessRole: 'owner' }], nextPageToken: 'next' })
    }
    if (request.method === 'POST') {
      const event = await request.json()
      if (!event.id) {
        selected.push(url.pathname)
        return Response.json({ id: 'selected-event' })
      }
      assert.equal(event.id, 'dbt' + taskId.replaceAll('-', ''))
      if (sent.has(event.id)) return new Response(null, { status: 409 })
      sent.set(event.id, event)
      return Response.json({ id: event.id })
    }
    if (url.pathname.endsWith('/events/lunch')) {
      assert.match(url.pathname, /meals%40example\.test/)
      if (request.method === 'GET') return Response.json({ id: 'lunch', etag: '"v1"', summary: 'Almoço' })
      assert.equal(request.headers.get('if-match'), '"v1"')
      if (request.method === 'PATCH') {
        edited.push(await request.json())
        return Response.json({ id: 'lunch' })
      }
      assert.equal(request.method, 'DELETE')
      return new Response(null, { status: 204 })
    }
    assert.doesNotMatch(url.pathname, /calendars\/(senac|rotinas|shared)\/events/)
    if (url.pathname.includes('meals%40example.test')) {
      return Response.json({ items: [{ id: 'lunch', summary: 'Almoço', start: { date: '2026-11-24' } }] })
    }
    return Response.json({ items: [] })
  })
  const { createGoogleEvent, listGoogleEvents, manageGoogleEvent } = await import('../supabase/functions/_shared/googleCalendar.ts')
  const { exportGoogleAgenda } = await import('../supabase/functions/_shared/googleAgendaExport.ts')
  const listing = await listGoogleEvents(userId, '2026-11-24T03:00:00Z', '2026-11-25T03:00:00Z')
  assert.deepEqual(listing.warnings, [])
  assert.deepEqual(listing.events.map(({ summary, calendarName }) => [summary, calendarName]), [['Almoço', 'Refeições']])
  assert.deepEqual(await exportGoogleAgenda(userId, 0, 'America/Sao_Paulo'), { sent: 1, failed: 0, next: null })
  assert.deepEqual(await exportGoogleAgenda(userId, 0, 'America/Sao_Paulo'), { sent: 0, failed: 0, next: null })
  const [event] = sent.values()
  assert.equal(event.start.dateTime, '2026-11-24T22:00:00.000Z')
  assert.match(event.description, /Revisar pauta\nCategoria: Trabalho\nPrioridade: Alta/)
  assert.equal(event.reminders.overrides[0].minutes, 10)
  await createGoogleEvent(userId, { calendarId: 'meals@example.test', title: 'Jantar', start: '2026-11-24T22:00:00Z' })
  await assert.rejects(createGoogleEvent(userId, { calendarId: 'unlisted@example.test', title: 'Jantar', start: '2026-11-24T22:00:00Z' }), /invalid_calendar/)
  assert.deepEqual(selected, ['/calendar/v3/calendars/meals%40example.test/events'])
  const ref = { calendarId: listing.events[0].calendarId, eventId: 'lunch', etag: '"v1"' }
  assert.equal((await manageGoogleEvent(userId, ref, { method: 'GET' })).summary, 'Almoço')
  await manageGoogleEvent(userId, ref, { method: 'PATCH', input: {
    title: 'Almoço de trabalho', description: null, start: '2026-11-25', allDay: true, category: 'work',
  } })
  assert.deepEqual(edited, [{
    summary: 'Almoço de trabalho', description: '', start: { date: '2026-11-25' }, end: { date: '2026-11-26' },
    extendedProperties: { private: { digitalBrainCategory: 'work' } },
  }])
  assert.deepEqual(await manageGoogleEvent(userId, ref, { method: 'DELETE' }), { id: 'lunch' })
  await assert.rejects(manageGoogleEvent(userId, { ...ref, eventId: '..' }, { method: 'DELETE' }), /invalid_event/)
})
