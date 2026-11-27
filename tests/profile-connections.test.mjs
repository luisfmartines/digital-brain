import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

test('public-profile lists an authenticated user’s requested profile connections with a cursor', async (t) => {
  const idFor = (index) => '11111111-1111-4111-8111-' + String(index).padStart(12, '0')
  const viewer = idFor(1)
  const target = idFor(2)
  const otherProfiles = Array.from({ length: 42 }, (_, index) => idFor(index + 3))
  const publicColumns = 'id,display_name,username,avatar_url'
  let handler
  let databaseRequests = 0

  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return next(specifier === 'npm:@supabase/supabase-js@2' ? '@supabase/supabase-js' : specifier, context)
    },
  })
  globalThis.Deno = {
    env: { get: (key) => ({
      SUPABASE_URL: 'https://supabase.test', SUPABASE_ANON_KEY: 'public-test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    })[key] },
    serve: (callback) => { handler = callback },
  }
  t.after(() => { hooks.deregister(); delete globalThis.Deno })
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    assert.equal(url.hostname, 'supabase.test')
    if (url.pathname === '/auth/v1/user') {
      assert.equal(request.headers.get('authorization'), 'Bearer session-test')
      return Response.json({ id: viewer })
    }
    databaseRequests++
    assert.equal(request.headers.get('authorization'), 'Bearer service-test')
    if (url.pathname.endsWith('/follows')) {
      const isFollowers = url.searchParams.has('following_id') && url.searchParams.get('following_id').startsWith('eq.')
      const [filter, order] = isFollowers ? ['following_id', 'follower_id'] : ['follower_id', 'following_id']
      assert.equal(url.searchParams.get(filter), 'eq.' + target)
      assert.equal(url.searchParams.get('order'), order + '.asc')
      assert.equal(url.searchParams.get('limit'), '41')
      const cursor = url.searchParams.get(order)?.slice(3)
      const ids = isFollowers ? otherProfiles.filter((id) => !cursor || id > cursor) : [viewer]
      return Response.json(ids.slice(0, 41).map((id) => ({ [filter]: target, [order]: id })))
    }
    assert.equal(url.pathname, '/rest/v1/profiles')
    assert.equal(url.searchParams.get('select'), publicColumns)
    const filter = url.searchParams.get('id')
    const ids = filter.startsWith('eq.') ? [target] : filter.slice(4, -1).split(',')
    return Response.json(ids.map((id) => ({ id, display_name: id.slice(-3), username: null, avatar_url: null })))
  })

  await import('../supabase/functions/public-profile/index.ts')
  const send = (body, authenticated = true) => handler(new Request('https://app.test/public-profile', {
    method: 'POST',
    headers: authenticated ? { Authorization: 'Bearer session-test' } : {},
    body: JSON.stringify({ action: 'connections', id: target, ...body }),
  }))

  assert.equal((await send({ direction: 'followers' }, false)).status, 401)
  assert.equal((await send({ direction: 'inbound' })).status, 400)
  assert.equal((await send({ direction: 'followers', cursor: 'invalid' })).status, 400)
  assert.equal(databaseRequests, 0)

  const first = await (await send({ direction: 'followers' })).json()
  assert.equal(first.profile.id, target)
  assert.deepEqual(first.profiles.map(({ id }) => id), otherProfiles.slice(0, 40))
  assert.equal(first.next, otherProfiles[39])
  const second = await (await send({ direction: 'followers', cursor: first.next })).json()
  assert.deepEqual(second.profiles.map(({ id }) => id), otherProfiles.slice(40))
  assert.equal(second.next, null)
  const following = await (await send({ direction: 'following' })).json()
  assert.deepEqual(following.profiles.map(({ id }) => id), [viewer])
})
