import { test, expect } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const hostId = '22222222-2222-4222-8222-222222222222'
const groupId = '33333333-3333-4333-8333-333333333333'
const challengeId = '44444444-4444-4444-8444-444444444444'
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const me = { id: userId, display_name: 'Alex', username: 'alex', onboarding_completed: true, enabled_modules: ['workouts', 'assistant'] }
const host = { id: hostId, display_name: 'Marina', username: 'marina' }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sb-psjuvnsgelfreckmmtky-auth-token', JSON.stringify({
      access_token: 'test-session', refresh_token: 'test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id: userId, email: 'test@example.test' },
    }))
  }, { userId })

  const posts = []
  const groups = [{ id: groupId, owner_id: hostId, name: 'Corrida de bairro', bio: 'Treinos no parque aos sábados.', category: 'Corrida', photo_url: null, host, members: [{ count: 0 }] }]
  const joined = new Set()
  const challenges = [{
    id: challengeId, name: 'Treine durante 7 dias', description: 'Registre um treino por dia.',
    starts_on: '2026-11-28', ends_on: '2026-12-05', duration_days: 7,
    participant_count: 1, active_days: 0, joined: false, is_creator: false, closed: false,
  }]
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const name = url.pathname.split('/').at(-1)
    const method = req.method()
    let body = []
    if (name === 'profiles') body = url.searchParams.get('id')?.startsWith('in.') ? [me, host] : url.searchParams.get('id') === 'eq.' + hostId ? host : me
    if (name === 'posts') body = posts.filter((post) => url.searchParams.get('discoverable') !== 'eq.true' || post.discoverable)
    if (name === 'publish_social_post') {
      const data = req.postDataJSON()
      const at = new Date()
      posts.unshift({
        id: data.draft_id, user_id: userId, created_at: at.toISOString(),
        caption: data.post_caption, photo_urls: data.selected_photos, discoverable: data.explore,
        workout: data.activity_category ? {
          id: data.draft_id, name: data.activity_name ?? data.activity_category, activity_category: data.activity_category, distance_km: data.activity_distance,
          started_at: new Date(at.getTime() - (data.activity_minutes ?? 0) * 60_000).toISOString(), ended_at: at.toISOString(), paused_seconds: 0, workout_sets: [],
        } : null,
      })
      body = data.selected_photos
    }
    if (name === 'leaderboard_week') body = [{ user_id: userId, workouts: 1, minutes: 38, volume_kg: 0 }]
    if (name === 'list_workout_challenges') body = challenges
    if (name === 'workout_challenges' && method === 'POST') {
      const input = req.postDataJSON()
      challenges.unshift({
        ...input, ends_on: new Date(Date.parse(input.starts_on) + input.duration_days * 86_400_000).toISOString().slice(0, 10),
        participant_count: 1, active_days: 0, joined: true, is_creator: true, closed: false,
      })
      return route.fulfill({ status: 201 })
    }
    if (name === 'workout_challenge_members') {
      const challenge = challenges.find(({ id }) => id === (method === 'POST' ? req.postDataJSON().challenge_id : url.searchParams.get('challenge_id')?.slice(3)))
      challenge.joined = method === 'POST'
      challenge.participant_count = challenge.joined ? 2 : 1
      challenge.active_days = challenge.joined ? 1 : 0
      return route.fulfill({ status: method === 'POST' ? 201 : 204 })
    }
    if (name === 'create_community') {
      const input = req.postDataJSON()
      groups.push({ id: input.draft_id, owner_id: userId, name: input.community_name, bio: input.community_bio,
        category: input.community_category, photo_url: input.cover_url, host: me, members: [{ count: 0 }] })
      body = input.cover_url
    }
    if (name === 'communities') {
      const id = url.searchParams.get('id')?.slice(3)
      if (method === 'DELETE') {
        const index = groups.findIndex((community) => community.id === id && community.owner_id === userId)
        if (index === -1) return route.fulfill({ json: null })
        const [group] = groups.splice(index, 1)
        joined.delete(group.id)
        return route.fulfill({ json: { id: group.id, photo_url: group.photo_url } })
      }
      if (method === 'PATCH') {
        const group = groups.find((community) => community.id === id && community.owner_id === userId)
        Object.assign(group, req.postDataJSON())
        return route.fulfill({ json: { photo_url: group.photo_url } })
      }
      body = id ? groups.find((group) => group.id === id) ?? null
        : groups.filter((group) => !url.searchParams.has('owner_id') || group.owner_id === userId)
    }
    if (name === 'list_community_cards') {
      const { mine_only, search_term, category_filter } = req.postDataJSON()
      body = groups
        .filter((group) => (group.owner_id === userId || joined.has(group.id)) === mine_only)
        .filter((group) => (!search_term || group.name.includes(search_term)) && (!category_filter || group.category === category_filter))
        .map((group) => ({ ...group, member_total: 1 + group.members[0].count }))
    }
    if (name === 'community_members') {
      if (method === 'POST') {
        const { community_id } = req.postDataJSON()
        joined.add(community_id)
        groups.find(({ id }) => id === community_id).members[0].count = 1
        return route.fulfill({ status: 201 })
      }
      const group = url.searchParams.get('community_id')?.slice(3)
      if (method === 'HEAD') {
        return route.fulfill({ status: 200, headers: {
          'Content-Range': joined.has(group) ? '0-0/1' : '*/0',
          'Access-Control-Expose-Headers': 'Content-Range',
        } })
      }
      if (method === 'DELETE') {
        joined.delete(group)
        groups.find(({ id }) => id === group).members[0].count = 0
        return route.fulfill({ status: 204 })
      }
      const select = url.searchParams.get('select')
      if (select === 'user_id') body = joined.has(group) ? { user_id: userId } : null
      else if (select?.startsWith('person:')) body = joined.has(group) ? [{ person: me }] : []
      else body = groups.filter(({ id }) => joined.has(id)).map((community) => ({ community }))
    }
    if (url.pathname.includes('/storage/v1/object/')) {
      if (method === 'POST') return route.fulfill({ json: { Key: url.pathname } })
      if (method === 'DELETE') return route.fulfill({ json: [] })
      return route.fulfill({ contentType: 'image/gif', body: gif })
    }
    return route.fulfill({ json: body })
  })
  await page.goto('/?tab=feed')
})

async function attachPhoto(page, dialog) {
  await dialog.getByRole('button', { name: 'Adicionar foto' }).click()
  const choosing = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher da galeria' }).click()
  await (await choosing).setFiles({ name: 'treino.gif', mimeType: 'image/gif', buffer: gif })
}

test('publishes a workout with its modality in the header from the fixed feed action', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Seções do feed' })
  await expect(nav.getByRole('link', { name: 'Amigos' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Assistente de IA' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nova publicação' })).toHaveCount(0)
  const button = page.getByRole('button', { name: 'Adicionar treino' })
  await expect(button).toBeVisible()
  expect(await button.evaluate((el) => getComputedStyle(el.parentElement).position)).toBe('fixed')
  await expect(button).not.toHaveAttribute('draggable', 'true')
  await button.click()
  const workout = page.getByRole('dialog', { name: 'Adicionar treino' })
  await workout.getByRole('button', { name: 'Modalidade' }).click()
  const picker = page.getByRole('dialog', { name: 'Modalidades' })
  await picker.getByRole('searchbox', { name: 'Buscar modalidade' }).fill('Cicli')
  await picker.getByRole('button', { name: 'Ciclismo' }).click()
  await expect(workout.getByLabel('Nome do treino')).toHaveCount(0)
  await expect(workout.getByLabel('Duração (min)')).toHaveCount(0)
  await expect(workout.getByLabel('Distância (km)')).toHaveCount(0)
  await workout.getByLabel('Legenda do treino').fill('Pedal da manhã')
  await attachPhoto(page, workout)
  await workout.getByRole('checkbox', { name: 'Mostrar em Explorar' }).check()
  const publishing = page.waitForRequest((request) => request.url().includes('/rpc/publish_social_post'))
  await workout.getByRole('button', { name: 'Publicar treino' }).click()
  expect((await publishing).postDataJSON()).toMatchObject({ activity_category: 'Ciclismo', activity_minutes: null, activity_distance: null })
  const activity = page.getByRole('listitem').filter({ hasText: 'Pedal da manhã' })
  await expect(activity).toContainText('Ciclismo')
  await expect(activity.getByRole('img', { name: 'Foto 1 da publicação' })).toBeVisible()
  expect(await activity.getByText('Ciclismo', { exact: true }).evaluate((el) => el.getBoundingClientRect().top))
    .toBeLessThan(await activity.getByText('Pedal da manhã').evaluate((el) => el.getBoundingClientRect().top))
  await nav.getByRole('link', { name: 'Explorar' }).click()
  await expect(page.getByText('Pedal da manhã')).toBeVisible()
})

test('lists user-created challenges, supports joining and leaving, and creates one with a fixed action', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Seções do feed' }).getByRole('link', { name: 'Desafios' }).click()
  const challenge = page.getByRole('listitem').filter({ hasText: 'Treine durante 7 dias' })
  await challenge.getByRole('button', { name: 'Entrar no desafio' }).click()
  await expect(challenge.getByRole('progressbar')).toHaveAttribute('value', '1')
  await expect(challenge.getByText('2 participantes')).toBeVisible()
  await challenge.getByRole('button', { name: 'Sair do desafio' }).click()
  await expect(challenge.getByRole('button', { name: 'Entrar no desafio' })).toBeVisible()

  const create = page.getByRole('button', { name: 'Criar desafio' })
  expect(await create.evaluate((el) => getComputedStyle(el.parentElement).position)).toBe('fixed')
  await create.click()
  const dialog = page.getByRole('dialog', { name: 'Criar desafio' })
  await dialog.getByLabel('Nome do desafio').fill('30 dias em movimento')
  await dialog.getByLabel('Descrição').fill('Um treino por dia, em qualquer modalidade.')
  await dialog.getByRole('button', { name: 'Criar desafio' }).click()
  await expect(page.getByRole('heading', { name: '30 dias em movimento' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Progresso no desafio 30 dias em movimento' })).toHaveAttribute('max', '30')
})

test('opens the side menu and creates, joins, and leaves communities', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir menu lateral' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu.getByRole('link', { name: 'Neural' })).toHaveCount(0)
  await menu.getByRole('link', { name: 'Comunidades' }).click()
  await expect(menu).toHaveCount(0)
  await page.getByRole('link', { name: /Corrida de bairro/ }).click()
  await expect(page.getByText('Treinos no parque aos sábados.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Marina/ })).toHaveAttribute('href', '/profiles/' + hostId)
  await expect(page.getByRole('link', { name: 'Editar comunidade' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Excluir comunidade' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Entrar na comunidade' }).click()
  await expect(page.getByText('Você faz parte')).toBeVisible()
  await expect(page.getByText('2 membros · Pública')).toBeVisible()
  await page.getByRole('button', { name: 'Sair da comunidade' }).click()
  await page.getByRole('dialog', { name: 'Sair da comunidade?' }).getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Entrar na comunidade' })).toBeVisible()

  await page.getByRole('link', { name: 'Voltar às comunidades' }).click()
  await page.getByRole('link', { name: 'Criar comunidade' }).click()
  await page.getByLabel('Nome da comunidade').fill('Equipe do tatame')
  await page.getByLabel('Bio').fill('Treinos de terça e quinta.')
  await page.getByRole('button', { name: 'Modalidade' }).click()
  await page.getByRole('searchbox', { name: 'Buscar modalidade' }).fill('Jiu')
  await page.getByRole('button', { name: 'Jiu-jitsu' }).click()
  await attachPhoto(page, page.getByRole('main'))
  await expect(page.getByRole('img', { name: 'Foto da comunidade' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar comunidade' }).click()
  await expect(page.getByRole('heading', { name: 'Equipe do tatame' })).toBeVisible()
  await expect(page.getByText('Você criou esta comunidade')).toBeVisible()
  await page.getByRole('link', { name: 'Editar comunidade' }).click()
  await expect(page.getByLabel('Nome da comunidade')).toHaveValue('Equipe do tatame')
  await page.getByLabel('Nome da comunidade').fill('Equipe do tatame BJJ')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByRole('heading', { name: 'Equipe do tatame BJJ' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar às comunidades' }).click()
  await expect(page.getByRole('link', { name: /Equipe do tatame BJJ/ })).toBeVisible()
  await expect(page.getByRole('main').getByRole('heading').first()).toHaveText('Minhas comunidades')

  await page.getByRole('link', { name: /Equipe do tatame BJJ/ }).click()
  const remove = page.getByRole('button', { name: 'Excluir comunidade' })
  await remove.click()
  const confirmation = page.getByRole('dialog', { name: 'Excluir comunidade?' })
  await expect(confirmation).toContainText('Equipe do tatame BJJ')
  await confirmation.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Equipe do tatame BJJ' })).toBeVisible()
  await remove.click()
  await confirmation.getByRole('button', { name: 'Excluir comunidade' }).click()
  await expect(page).toHaveURL('/?tab=feed&section=communities')
  await expect(page.getByRole('link', { name: /Equipe do tatame BJJ/ })).toHaveCount(0)
})
