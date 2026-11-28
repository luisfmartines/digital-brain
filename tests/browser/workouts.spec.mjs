import { test, expect } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const exercise = { id: userId + ':saved-media', name: 'Supino salvo', muscle_group: 'chest', equipment: 'barbell', user_id: userId }
const routine = { id: 'routine-test', name: 'Treino A', focus: '', tags: [], routine_exercises: [
  { id: 'row', position: 0, target_sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90, exercise },
] }
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sb-psjuvnsgelfreckmmtky-auth-token', JSON.stringify({
      access_token: 'test-session', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id: userId, email: 'test@example.test' },
    }))
  }, { userId })
  await page.route('https://*.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body = []
    if (path.endsWith('/profiles')) body = { id: userId, onboarding_completed: true, enabled_modules: ['workouts'] }
    if (path.endsWith('/workout_routines')) body = routine
    if (path.endsWith('/exercises')) body = route.request().method() === 'POST' ? route.request().postDataJSON() : [exercise]
    if (path.endsWith('/exercise_media_links')) body = { external_id: 'saved-media' }
    await route.fulfill({ json: body })
  })
  await page.route('https://oss.exercisedb.dev/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/exercises') ? [
      { exerciseId: 'broken', name: 'Mídia indisponível', gifUrl: 'https://media.test/broken.gif' },
      { exerciseId: 'recoverable', name: 'Mídia atualizada', gifUrl: 'https://media.test/old.gif' },
      { exerciseId: 'EIeI8Vf', name: 'barbell bench press', gifUrl: 'https://media.test/good.gif', targetMuscles: ['pectorals'], equipments: ['barbell'], instructions: ['Step:3 Brace the torso and align the wrists with the forearms.'] },
    ] : { exerciseId: path.split('/').pop(), name: 'barbell bench press', gifUrl: path.endsWith('/broken') ? 'https://media.test/broken.gif' : 'https://media.test/good.gif', instructions: ['Step:3 Brace the torso and align the wrists with the forearms.'] }
    await route.fulfill({ json: { success: true, data, meta: { hasNextPage: false } } })
  })
  await page.route('https://media.test/**', (route) => route.request().url().endsWith('/good.gif')
    ? route.fulfill({ contentType: 'image/gif', body: gif })
    : route.fulfill({ status: 404 }))
  await page.goto('/workouts/routines/routine-test/edit')
})

test('clear 3, type 4, and persist exactly four sets', async ({ page }) => {
  const input = page.getByLabel('Séries', { exact: true })
  await expect(input).toHaveValue('3')
  await input.fill('')
  await expect(input).toHaveValue('')
  await input.pressSequentially('4')
  await expect(input).toHaveValue('4')
  const request = page.waitForRequest((req) => req.url().includes('/rest/v1/routine_exercises') && req.method() === 'POST')
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click()
  const row = (await request).postDataJSON()[0]
  expect(row.target_sets).toBe(4)
  expect(row).not.toHaveProperty('target_reps')
  await expect(page.getByLabel('Repetições', { exact: true })).toHaveCount(0)
  expect(row).not.toHaveProperty('reps_min')
  expect(row).not.toHaveProperty('reps_max')
})

test('empty and out-of-range sets do not save or silently become ten', async ({ page }) => {
  const input = page.getByLabel('Séries', { exact: true })
  await input.fill('')
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click()
  await expect(page.getByText('Informe um número inteiro de 1 a 10 séries para cada exercício.')).toBeVisible()
  await input.fill('14')
  await expect(input).toHaveValue('14')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await input.fill('10')
  await expect(input).toHaveAttribute('aria-invalid', 'false')
})

test('tapping a routine previews its exercises and leaves the workout unstarted', async ({ page }) => {
  let starts = 0
  await page.route('**/rest/v1/workout_routines?*', (route) => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('id') ? routine : [routine],
  }))
  await page.route('**/rest/v1/workouts?*', (route) => {
    if (route.request().method() !== 'GET') starts += 1
    const url = new URL(route.request().url())
    return route.fulfill({ json: url.searchParams.get('routine_id') === 'eq.routine-test' ? [{
      id: 'last-routine-run', ended_at: new Date().toISOString(), started_at: new Date(Date.now() - 900000).toISOString(),
      paused_seconds: 0,
      workout_sets: [{ id: 'last-set', exercise_id: exercise.id, completed: true, is_warmup: false, set_number: 1, weight_kg: 30, reps: 8 }],
    }] : [] })
  })
  await page.goto('/workouts')
  const card = page.getByRole('list', { name: 'Rotinas de treino' }).getByRole('listitem')
  await card.getByText(routine.name, { exact: true }).click()
  await expect(page).toHaveURL('/workouts/routines/routine-test')
  await expect(page.getByRole('heading', { name: routine.name, level: 1 })).toBeVisible()
  await expect(page.getByText('3 séries · 1 min 30 s de descanso')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Séries anteriores de Supino salvo' })).toContainText('30 kg')
  await expect(page.getByText('240 kg')).toBeVisible()
  await page.getByRole('button', { name: 'Repetições', exact: true }).click()
  await expect(page.getByText('8 reps')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar treino' })).toBeVisible()
  expect(starts).toBe(0)
})

test('a feed post opens its conversation with avatars, likes and threaded replies', async ({ page }) => {
  const friend = { id: 'friend', display_name: 'Marina', username: 'marina', avatar_url: 'https://media.test/good.gif' }
  const me = { id: userId, display_name: 'Atleta', username: 'atleta' }
  const postId = 'test-post'
  const at = new Date().toISOString()
  const comments = [{ id: 'first', user_id: friend.id, post_id: postId, parent_id: null, content: 'Boa série!', created_at: at }]
  let liked = false
  await page.route('**/rest/v1/posts?*', (route) => route.fulfill({ json: [{
    id: postId, user_id: friend.id, created_at: at, photo_url: null, caption: 'Dia de treino',
    workout: { id: 'public-workout', name: 'Treino A', started_at: at, ended_at: at, paused_seconds: 0, workout_sets: [] },
  }] }))
  await page.route('**/rest/v1/profiles?*', (route) => route.fulfill({
    json: new URL(route.request().url()).searchParams.get('id')?.startsWith('in.')
      ? [friend, me] : { ...me, onboarding_completed: true, enabled_modules: ['workouts'] },
  }))
  await page.route('**/rest/v1/post_comments*', (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON()
      expect(payload).toEqual({ post_id: postId, content: 'Valeu!', parent_id: 'first' })
      comments.push({ ...payload, id: 'reply', user_id: userId, created_at: at })
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: comments.map((comment) => ({
      ...comment,
      like_summary: [{ count: comment.id === 'first' && liked ? 1 : 0 }],
      my_like: comment.id === 'first' && liked ? [{ user_id: userId }] : [],
    })) })
  })
  await page.route('**/rest/v1/post_comment_likes*', (route) => {
    liked = route.request().method() === 'POST'
    return route.fulfill({ status: 204 })
  })
  await page.goto('/?tab=feed')
  await page.getByRole('button', { name: 'Comentários', exact: true }).click()
  await expect(page).toHaveURL('/feed/posts/test-post/comments')
  await expect(page.getByRole('heading', { name: 'Comentários' })).toBeVisible()
  const thread = page.getByRole('list', { name: 'Comentários da publicação' })
  await expect(thread.getByRole('link', { name: 'Ver perfil de Marina' }).locator('img')).toHaveAttribute('src', friend.avatar_url)
  const like = thread.getByRole('button', { name: 'Curtir comentário de Marina' })
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'true')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', 'false')
  await thread.getByRole('button', { name: 'Responder' }).click()
  await page.getByRole('textbox', { name: 'Sua resposta' }).fill('Valeu!')
  await page.getByRole('button', { name: 'Enviar resposta' }).click()
  const reply = thread.getByRole('listitem').filter({ hasText: 'Valeu!' })
  await expect(reply).toContainText('Em resposta a Marina')
  await expect(page.getByRole('link', { name: 'Treino A' })).toHaveAttribute('href', '/workouts/view/public-workout')
})

test('the custom exercise icon opens editing and saves a new photo', async ({ page }) => {
  const custom = { ...exercise, id: 'custom-edit', name: 'Remada livre' }
  let saved = custom
  await page.route('**/rest/v1/exercises?*', (route) => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: [saved] })
    saved = { ...saved, ...route.request().postDataJSON() }
    return route.fulfill({ json: saved })
  })
  await page.route('**/storage/v1/object/exercise-photos/**', (route) => route.fulfill({ json: { Key: 'exercise-photos/custom-edit.jpg' } }))
  await page.route('**/storage/v1/object/sign/exercise-photos/**', (route) => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'image/gif', body: gif })
    : route.fulfill({ json: { signedURL: '/object/sign/exercise-photos/' + saved.photo_path + '?token=test' } }))
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await page.getByRole('button', { name: 'Editar Remada livre' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar exercício' })
  await edit.getByLabel('Nome do exercício').fill('Remada unilateral')
  await edit.getByRole('button', { name: 'Adicionar foto' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Escolher da galeria' }).click()
  await (await chooser).setFiles({ name: 'remada.gif', mimeType: 'image/gif', buffer: gif })
  await expect(edit.getByRole('img', { name: 'Prévia da foto do exercício' })).toBeVisible()
  await edit.getByRole('button', { name: 'Salvar exercício' }).click()
  const updated = page.getByRole('button', { name: 'Editar Remada unilateral' })
  await expect(updated.getByRole('img', { name: 'Demonstração: Remada unilateral' })).toBeVisible()
  expect(saved.photo_path).toBe(userId + '/custom-edit.jpg')
})

test('finished workouts share outside Hebbian and photo removal updates the feed', async ({ page }) => {
  const custom = { ...exercise, id: 'custom', name: 'Minha remada', photo_path: userId + '/custom.jpg' }
  const workout = {
    id: 'logged', user_id: userId, name: 'Treino registrado', started_at: new Date(Date.now() - 60000).toISOString(),
    ended_at: null, paused_at: null, paused_seconds: 0, photo_url: null, photo_urls: [],
    workout_sets: [
      { id: 'warmup', exercise_id: custom.id, exercise_order: 0, set_number: 1, completed: true, is_warmup: true, weight_kg: 10, reps: 10, exercise: custom },
      { id: 'prep', exercise_id: custom.id, exercise_order: 0, set_number: 2, completed: true, is_warmup: true, set_type: 'preparatory', weight_kg: 20, reps: 5, exercise: custom },
    ],
  }
  let uploads = 0
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async (content) => { window.lastShare = content } })
  })
  await page.route('**/rest/v1/workouts?*', (route) => {
    const url = new URL(route.request().url())
    return route.fulfill({ json: url.searchParams.get('id') ? workout : url.searchParams.get('ended_at') === 'not.is.null' ? [workout] : [] })
  })
  await page.route('**/rest/v1/posts?*', (route) => route.fulfill({
    json: workout.ended_at ? [{ id: 'post', user_id: userId, workout, created_at: workout.ended_at, photo_url: workout.photo_url, photo_urls: workout.photo_urls }] : [],
  }))
  await page.route('**/rest/v1/profiles?*', (route) => route.fulfill({
    json: new URL(route.request().url()).searchParams.get('id')?.startsWith('in.')
      ? [{ id: userId, display_name: 'Atleta', username: 'atleta' }]
      : { id: userId, onboarding_completed: true, enabled_modules: ['workouts'] },
  }))
  await page.route('**/rest/v1/exercise_media_links?*', (route) => route.fulfill({ json: [] }))
  await page.route('**/storage/v1/object/post-media/**', (route) => {
    if (route.request().method() === 'POST') uploads += 1
    return route.fulfill({ json: { Key: 'post-media/photo.jpg' } })
  })
  await page.route('**/storage/v1/object/public/post-media/**', (route) => route.fulfill({ contentType: 'image/gif', body: gif }))
  await page.route('**/storage/v1/object/sign/exercise-photos/**', (route) => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'image/gif', body: gif })
    : route.fulfill({ json: { signedURL: '/object/sign/exercise-photos/' + custom.photo_path + '?token=test' } }))
  await page.route('**/rest/v1/rpc/finish_workout_with_photos', (route) => {
    const request = route.request().postDataJSON()
    expect(request.session_id).toBe(workout.id)
    expect(request.selected_photos).toHaveLength(1)
    workout.photo_urls = request.selected_photos
    workout.photo_url = workout.photo_urls[0]
    workout.ended_at = new Date().toISOString()
    return route.fulfill({ json: workout.photo_urls })
  })
  await page.route('**/rest/v1/rpc/remove_finished_workout_photo', (route) => {
    expect(route.request().postDataJSON()).toEqual({ session_id: workout.id, photo_url_to_remove: workout.photo_url })
    workout.photo_urls = []
    workout.photo_url = null
    return route.fulfill({ json: true })
  })
  await page.route('**/rest/v1/workout_routines?*', (route) => route.fulfill({ json: [] }))
  await page.goto('/workouts/summary/logged?review=1')
  for (let index = 1; index <= 2; index += 1) {
    await page.getByRole('button', { name: 'Adicionar foto', exact: true }).click()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Escolher da galeria' }).click()
    await (await chooser).setFiles({ name: 'treino.gif', mimeType: 'image/gif', buffer: gif })
    await expect(page.getByRole('img', { name: `Foto ${index} do treino` })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Remover foto 1' }).click()
  await expect(page.getByRole('img', { name: 'Foto 2 do treino' })).toHaveCount(0)
  expect(uploads).toBe(0)
  await page.getByRole('button', { name: 'Finalizar treino' }).click()
  await expect(page.getByRole('heading', { name: 'Treino concluído!' })).toBeVisible()
  expect(uploads).toBe(1)
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.lastShare?.text)).toContain('Treino registrado')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('200 kg de volume')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Foto 1 da publicação' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Foto 2 da publicação' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver treino completo: Treino registrado' }).click()
  const photo = page.getByRole('img', { name: 'Foto de Minha remada' })
  await expect(photo).toBeVisible()
  await expect(photo).toHaveJSProperty('naturalWidth', 1)
  await expect(page.getByRole('button', { name: 'Remover foto 1' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver resumo' }).click()
  await expect(page.getByRole('heading', { name: 'Treino concluído!' })).toBeVisible()
  const remove = page.getByRole('button', { name: 'Remover foto 1' })
  const confirmation = page.getByRole('dialog', { name: 'Remover esta foto?' })
  await remove.click()
  await confirmation.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('img', { name: 'Foto 1 do treino' })).toBeVisible()
  await remove.click()
  await confirmation.getByRole('button', { name: 'Remover foto', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Foto 1 do treino' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('img', { name: 'Foto 1 da publicação' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ver treino completo: Treino registrado' })).toBeVisible()
})

test('saved exercises show GIFs and broken URLs recover or show an explicit fallback', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  const saved = page.getByRole('img', { name: 'Demonstração: Supino salvo', exact: true })
  await expect(saved).toBeVisible()
  await expect(saved).toHaveJSProperty('naturalWidth', 1)
  const recovered = page.getByRole('img', { name: 'Demonstração: Mídia atualizada', exact: true })
  await expect(recovered).toHaveAttribute('src', 'https://media.test/good.gif')
  await expect(page.getByRole('img', { name: 'Demonstração indisponível: Mídia indisponível', exact: true })).toBeVisible()
})

test('every exercise has details; preview shows Portuguese instructions without saving', async ({ page }) => {
  const writes = []
  page.on('request', (request) => {
    if (request.url().includes('.supabase.co/') && request.method() === 'POST') writes.push(request)
  })
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Ver detalhes de / })).toHaveCount(4)
  await page.getByRole('button', { name: 'Ver detalhes de Supino reto com barra', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Supino reto com barra', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('tab', { name: 'Instruções' }).click()
  await expect(dialog.getByText('Contraia o tronco e alinhe os punhos com os antebraços.', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(0)
  await dialog.getByText('Ver instruções originais em inglês', { exact: true }).click()
  await expect(dialog.getByText('Brace the torso and align the wrists with the forearms.', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Supino reto com barra', { exact: true })).toBeVisible()
  expect(writes.some((request) => request.url().includes('/exercises'))).toBe(true)
})

const replacement = { ...exercise, id: userId + ':replacement', name: 'Supino inclinado salvo' }

for (const update of [false, true]) {
  test(`active workout shows guidance, supports swipe and replacement, and sends routine choice ${update}`, async ({ page }) => {
    let sets = [1, 2, 3].map((n) => ({
      id: `set-${n}`, exercise_id: exercise.id, exercise_order: 0, set_number: n,
      weight_kg: 25, reps: 12, completed: false, is_warmup: false, exercise,
    }))
    let endedAt = null
    await page.route('**/rest/v1/exercises?*', (route) => route.fulfill({ json: [exercise, replacement] }))
    await page.route('**/rest/v1/workouts?*', async (route) => {
      const url = new URL(route.request().url())
      const active = url.searchParams.get('id') === 'eq.active-test'
      await route.fulfill({ json: active ? {
        id: 'active-test', name: routine.name, routine_id: routine.id, started_at: new Date(Date.now() - 70000).toISOString(),
        ended_at: endedAt, paused_at: null, paused_seconds: 0, photo_url: null, workout_sets: sets,
      } : [] })
    })
    await page.route('**/rest/v1/workout_sets?*', async (route) => {
      const request = route.request()
      const id = new URL(request.url()).searchParams.get('id')?.slice(3)
      if (request.method() === 'DELETE') sets = sets.filter((set) => set.id !== id)
      if (request.method() === 'PATCH') {
        const patch = request.postDataJSON()
        sets = sets.map((set) => !id || set.id === id ? {
          ...set, ...patch, exercise: patch.exercise_id === replacement.id ? replacement : set.exercise,
        } : set)
      }
      await route.fulfill(request.method() === 'PATCH' && id ? { json: { id } } : { status: 204 })
    })
    await page.route('**/rest/v1/rpc/finish_workout_with_photos', async (route) => {
      endedAt = new Date().toISOString()
      await route.fulfill({ json: [] })
    })
    await page.goto('/workouts/active/active-test')
    if (update) await page.setViewportSize({ width: 320, height: 844 })
    const exerciseHeader = page.locator('button[aria-expanded]').filter({ hasText: exercise.name })
    const thumbnail = page.getByRole('button', { name: 'Ampliar demonstração de Supino salvo' })
    await expect(thumbnail.getByRole('img', { name: 'Demonstração: Supino salvo', exact: true })).toBeVisible()
    await exerciseHeader.click()
    await expect(exerciseHeader).toHaveAttribute('aria-expanded', 'false')
    const thumbnailBox = await thumbnail.boundingBox()
    await thumbnail.click()
    const preview = page.getByRole('dialog', { name: 'Demonstração de Supino salvo' })
    const gifPreview = preview.getByRole('img', { name: 'Demonstração: Supino salvo', exact: true })
    await expect(gifPreview).toBeVisible()
    expect((await gifPreview.boundingBox()).width).toBeGreaterThan(thumbnailBox.width * 2)
    await preview.getByRole('button', { name: 'Fechar demonstração' }).click()
    await expect(preview).toBeHidden()
    await expect(exerciseHeader).toHaveAttribute('aria-expanded', 'false')
    await exerciseHeader.click()
    await page.getByRole('button', { name: 'Descanso entre séries, 1 min 30 s' }).click()
    const restDialog = page.getByRole('dialog', { name: 'Descanso entre séries' })
    const wheel = restDialog.getByRole('listbox', { name: 'Duração do descanso' })
    await expect(wheel.getByRole('option', { selected: true })).toHaveText('1 min 30 s')
    const restBox = await restDialog.boundingBox()
    expect(restBox.y + restBox.height).toBeCloseTo(page.viewportSize().height, 0)
    await wheel.hover()
    await page.mouse.wheel(0, 44)
    await expect(wheel.getByRole('option', { selected: true })).toHaveText('2 min')
    await restDialog.getByRole('button', { name: 'Aplicar descanso' }).click()
    await expect(page.getByRole('button', { name: 'Descanso entre séries, 2 min' })).toBeVisible()
    if (update) {
      const firstSet = page.getByRole('button', { name: 'Remover série 1' }).locator('..')
      const [number, weight, reps, done] = await Promise.all([
        firstSet.getByRole('button', { name: /^Tipo da série/ }).boundingBox(),
        firstSet.getByLabel('Peso em kg').boundingBox(),
        firstSet.getByLabel('Repetições').boundingBox(),
        firstSet.getByRole('button', { name: 'Marcar série como concluída' }).boundingBox(),
      ])
      expect(weight.y).toBeGreaterThan(number.y + number.height)
      expect(reps.x - (weight.x + weight.width)).toBeGreaterThanOrEqual(6)
      expect(done.x - (reps.x + reps.width)).toBeGreaterThanOrEqual(6)
    }
    await page.getByText('Instruções de execução', { exact: true }).click()
    await expect(page.getByText('Contraia o tronco e alinhe os punhos com os antebraços.')).toBeVisible()

    const firstRow = page.getByRole('button', { name: 'Remover série 1' }).locator('..')
    await firstRow.scrollIntoViewIfNeeded()
    const row = await firstRow.boundingBox()
    const touch = await page.context().newCDPSession(page)
    const y = Math.round(row.y + row.height / 2)
    const x = Math.round(row.x + row.width * 0.65)
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 36, y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 100, y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('button', { name: 'Remover série 1' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Opções do exercício' }).click()
    await page.getByRole('button', { name: 'Substituir exercício' }).click()
    await page.getByRole('button', { name: /Supino inclinado salvo/ }).filter({ hasText: 'Supino inclinado salvo' }).click()
    await expect(page.getByRole('img', { name: 'Demonstração: Supino inclinado salvo', exact: true })).toBeVisible()
    await expect(page.getByLabel('Peso em kg').first()).toHaveValue('')
    await expect(page.getByLabel('Repetições').first()).toHaveValue('')
    await page.getByRole('button', { name: 'Marcar série como concluída' }).first().click()
    const repsDialog = page.getByRole('dialog', { name: 'Informe as repetições' })
    await expect(repsDialog).toBeVisible()
    await repsDialog.getByRole('button', { name: 'Fechar' }).click()
    await page.getByLabel('Repetições').first().fill('8')
    await page.getByRole('button', { name: 'Marcar série como concluída' }).first().click()
    await page.getByRole('button', { name: 'Finalizar' }).click()
    const pending = page.getByRole('dialog', { name: 'Ainda há séries pendentes' })
    await expect(pending).toBeVisible()
    await pending.getByRole('button', { name: 'Fechar' }).click()
    await page.getByLabel('Repetições').last().fill('10')
    await page.getByRole('button', { name: 'Marcar série como concluída' }).last().click()
    await page.getByRole('button', { name: 'Finalizar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Atualizar a rotina?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: update ? 'Atualizar rotina' : 'Manter rotina original' }).click()
    await expect(page.getByRole('heading', { name: 'Revisar treino' })).toBeVisible()
    const finishing = page.waitForRequest('**/rest/v1/rpc/finish_workout_with_photos')
    await page.getByRole('button', { name: 'Finalizar treino' }).click()
    expect((await finishing).postDataJSON()).toEqual({ session_id: 'active-test', update_routine: update, selected_photos: [] })
    await expect(page).toHaveURL('/workouts/summary/active-test')
  })
}

test('friends and ranking open a profile with copyable routines even without workouts', async ({ page }) => {
  const friend = { id: '22222222-2222-4222-8222-222222222222', username: 'marina', display_name: 'Marina Albuquerque de Vasconcelos e Oliveira', avatar_url: null }
  await page.route('**/rest/v1/follows?*', (route) => {
    const outgoing = new URL(route.request().url()).searchParams.has('follower_id')
    return route.fulfill({ json: outgoing ? [{ following_id: friend.id }] : [] })
  })
  await page.route('**/rest/v1/profiles?*', (route) => {
    const ids = new URL(route.request().url()).searchParams.get('id')
    return route.fulfill({ json: ids?.startsWith('in.') ? [friend] :
      ids === `eq.${userId}` ? { id: userId, onboarding_completed: true, enabled_modules: ['workouts'] } : [] })
  })
  await page.route('**/rest/v1/rpc/leaderboard_week', (route) => route.fulfill({
    json: [{ ...friend, user_id: friend.id, volume_kg: 0, minutes: 0, sets: 0, workouts: 0, xp: 0, last_workout: null }],
  }))
  await page.route('**/functions/v1/public-profile', (route) => route.fulfill({ json:
    route.request().postDataJSON().action === 'copy' ? { id: 'new-routine' } : {
      ...friend, name: friend.display_name, avatar: null, sharing: true, completion: null,
      routines: [{ id: routine.id, name: 'Rotina sem treinos', focus: null, exercises: [{ name: exercise.name, sets: 3, reps: 12, rest: 90 }] }],
    },
  }))

  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Adicionar amigos' }).click()
  await expect(page.getByRole('heading', { name: 'Amigos adicionados' })).toBeVisible()
  const friendLink = page.getByRole('link', { name: friend.display_name, exact: true })
  const connected = page.getByRole('button', { name: 'Conectado', exact: true })
  await expect(friendLink).toHaveCSS('text-decoration-line', 'none')
  await expect(connected).toHaveCSS('white-space', 'nowrap')
  const [nameBox, actionBox] = await Promise.all([friendLink.boundingBox(), connected.boundingBox()])
  expect(nameBox.x + nameBox.width).toBeLessThan(actionBox.x)
  await friendLink.click()
  await page.getByRole('button', { name: /Rotina sem treinos.*1 exercício/ }).click()
  await expect(page.getByRole('dialog', { name: 'Rotina sem treinos' })).toBeVisible()
  await page.getByRole('button', { name: 'Copiar rotina' }).click()
  await expect(page.getByRole('link', { name: 'Abrir rotina copiada' })).toHaveAttribute('href', '/workouts/routines/new-routine/edit')

  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(page).toHaveURL(/\/friends\/add$/)
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/workouts?tab=ranking')
  await expect(page.getByRole('tab', { name: 'Feed dos amigos' })).toHaveCount(0)
  await page.getByRole('link', { name: /Marina/ }).click()
  await expect(page).toHaveURL(new RegExp(`/profiles/${friend.id}$`))
})

test('exercise creation saves an optional photo and displays it after reopening the exercise', async ({ page }) => {
  let created
  const order = []
  await page.route('**/rest/v1/exercises?*', async (route) => {
    if (route.request().method() === 'POST') {
      order.push('create')
      created = route.request().postDataJSON()
      return route.fulfill({ json: created })
    }
    await route.fulfill({ json: created ? [exercise, created] : [exercise] })
  })
  await page.route('**/storage/v1/object/exercise-photos/**', (route) => {
    order.push('upload')
    return route.fulfill({ json: { Key: new URL(route.request().url()).pathname } })
  })
  await page.route('**/storage/v1/object/sign/exercise-photos/**', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'image/gif', body: gif })
    return route.fulfill({ json: { signedURL: '/object/sign/exercise-photos/' + created.photo_path + '?token=test' } })
  })

  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await page.getByRole('button', { name: 'Criar exercício personalizado' }).click()
  await page.getByPlaceholder('Nome do exercício').fill('Minha remada')
  const photoSquare = page.getByRole('button', { name: 'Adicionar foto do exercício' })
  const square = await photoSquare.boundingBox()
  expect(square.width).toBeCloseTo(square.height, 0)
  await photoSquare.click()
  const sources = page.getByRole('dialog', { name: 'Foto do exercício' })
  const fileChooser = page.waitForEvent('filechooser')
  await sources.getByRole('button', { name: 'Usar câmera' }).click()
  const capture = await fileChooser
  expect(await capture.element().getAttribute('capture')).toBe('environment')
  await capture.setFiles({ name: 'remada.gif', mimeType: 'image/gif', buffer: gif })
  await expect(page.getByRole('img', { name: 'Prévia da foto do exercício' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover foto' }).click()
  await expect(page.getByRole('img', { name: 'Prévia da foto do exercício' })).toHaveCount(0)
  await photoSquare.click()
  const fileFromGallery = page.waitForEvent('filechooser')
  await sources.getByRole('button', { name: 'Escolher da galeria' }).click()
  const gallery = await fileFromGallery
  expect(await gallery.element().getAttribute('capture')).toBeNull()
  await gallery.setFiles({ name: 'remada.gif', mimeType: 'image/gif', buffer: gif })
  await page.getByRole('button', { name: 'Criar e adicionar' }).click()
  await expect(page.getByText('Minha remada', { exact: true })).toBeVisible()
  expect(created.photo_path).toBe(userId + '/' + created.id + '.jpg')
  expect(order).toEqual(['upload', 'create'])

  await page.goto('/workouts/exercises/' + created.id)
  const photo = page.getByRole('img', { name: 'Foto de Minha remada' })
  await expect(photo).toBeVisible()
  await expect(photo).toHaveJSProperty('naturalWidth', 1)
})

test('workout review can preview a camera photo when the WebView bitmap decoder rejects it', async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = async () => { throw new Error('Unsupported image') }
  })
  await page.route('**/rest/v1/workouts?*', async (route) => {
    await route.fulfill({ json: {
      id: 'photo-workout', name: 'Treino A', routine_id: null, started_at: '2026-11-24T12:00:00Z',
      ended_at: null, paused_at: null, paused_seconds: 0, photo_url: null,
      workout_sets: [{ id: 'set-photo', exercise_id: exercise.id, set_number: 1, reps: 8, completed: true, exercise }],
    } })
  })
  await page.goto('/workouts/summary/photo-workout?review=1')

  await page.getByRole('button', { name: /Adicionar foto/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar foto do treino' })
  const camera = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Usar câmera' }).click()
  const cameraChooser = await camera
  expect(await cameraChooser.element().getAttribute('capture')).toBe('environment')
  await cameraChooser.setFiles({ name: 'camera.gif', mimeType: 'image/gif', buffer: gif })
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('img', { name: 'Foto 1 do treino' })).toHaveJSProperty('naturalWidth', 1)

  await page.getByRole('button', { name: /Adicionar foto/ }).click()
  const gallery = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Escolher da galeria' }).click()
  const chooser = await gallery
  expect(await chooser.element().getAttribute('capture')).toBeNull()
  await chooser.setFiles({ name: 'treino.gif', mimeType: 'image/gif', buffer: gif })
  const photo = page.getByRole('img', { name: 'Foto 2 do treino', exact: true })
  await expect(photo).toBeVisible()
  await expect(photo).toHaveJSProperty('naturalWidth', 1)
})

test('partial and mistyped queries rank the matching catalogue exercise above weaker saved matches', async ({ page }) => {
  await page.route('**/rest/v1/exercises?*', (route) => route.fulfill({
    json: [{ ...exercise, id: 'custom-chair', name: 'Cadeira flexora personalizada', muscle_group: 'hamstrings' }],
  }))
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  const search = page.getByPlaceholder('Pesquisar exercícios')
  const results = page.getByRole('button', { name: /^Ver detalhes de / })

  await search.fill('cadeira flex')
  await expect(results.first()).toHaveAccessibleName('Ver detalhes de Cadeira flexora')
  await expect(page.getByRole('button', { name: 'Ver detalhes de Cadeira flexora personalizada' })).toBeVisible()
  await search.fill('cadeira fleoxra')
  await expect(results.first()).toHaveAccessibleName('Ver detalhes de Cadeira flexora')
})

test('a saved routine appears on the hub when the exercise photo column is unavailable', async ({ page }) => {
  let savedRoutine
  await page.route('**/rest/v1/workout_routines?*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.searchParams.get('select')?.includes('photo_path')) {
      return route.fulfill({ status: 400, json: { code: '42703', message: 'column exercises.photo_path does not exist' } })
    }
    if (request.method() === 'POST') {
      savedRoutine = { ...request.postDataJSON(), id: 'routine-new', routine_exercises: [] }
      return route.fulfill({ json: { id: savedRoutine.id } })
    }
    await route.fulfill({ json: savedRoutine ? [savedRoutine] : [] })
  })
  await page.route('**/rest/v1/routine_exercises*', async (route) => {
    savedRoutine.routine_exercises = route.request().postDataJSON().map((row) => ({ ...row, id: 'new-row', exercise }))
    await route.fulfill({ status: 204 })
  })
  await page.goto('/workouts/routines/new')
  await page.getByLabel('Nome da rotina').fill('Rotina recém-salva')
  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await page.getByRole('button', { name: /Supino salvo/ }).filter({ hasText: 'Supino salvo' }).click()
  await page.getByRole('button', { name: 'Salvar rotina', exact: true }).click()
  await expect(page).toHaveURL('/workouts')
  const grid = page.getByRole('list', { name: 'Rotinas de treino' })
  const routineCard = grid.getByRole('listitem').filter({ hasText: 'Rotina recém-salva' })
  await expect(routineCard.getByRole('heading', { name: 'Rotina recém-salva' })).toBeVisible()
  await expect(routineCard.getByText('1 exercício', { exact: true })).toBeVisible()
  await expect(routineCard.getByRole('button', { name: 'Iniciar Rotina recém-salva' })).toBeEnabled()
  await expect(routineCard).toHaveCSS('background-image', 'none')
  const featured = page.getByRole('region', { name: 'Treino de hoje' })
  await expect(featured.getByRole('heading', { name: 'Rotina recém-salva' })).toBeVisible()
  await expect(featured.getByText('1. Supino salvo')).toBeVisible()
  await expect(featured).toHaveCSS('background-image', 'none')
  const [featureBox, routineBox] = await Promise.all([featured.boundingBox(), routineCard.boundingBox()])
  expect(featureBox.width).toBeGreaterThan(routineBox.width)
  expect(featureBox.height).toBeGreaterThan(routineBox.height)
  const options = routineCard.getByRole('button', { name: 'Opções de Rotina recém-salva' })
  await options.click()
  await expect(routineCard.getByRole('link', { name: 'Editar rotina' })).toHaveAttribute('href', '/workouts/routines/routine-new/edit')
  await expect(routineCard.getByRole('button', { name: 'Excluir rotina' })).toBeVisible()
  await options.press('Escape')
  await expect(options).toHaveAttribute('aria-expanded', 'false')
})

test('an empty workout opens and lets the user change the rest for an exercise', async ({ page }) => {
  let active
  await page.route('**/rest/v1/workouts?*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST') {
      active = {
        ...request.postDataJSON(), id: 'quick-test', started_at: new Date().toISOString(),
        ended_at: null, paused_at: null, paused_seconds: 0, workout_sets: [], photo_url: null,
      }
      return route.fulfill({ json: { id: active.id } })
    }
    if (url.searchParams.get('id') === 'eq.quick-test') {
      if (url.searchParams.get('select').includes('photo_path,') || url.searchParams.get('select').includes('user_id, photo_path')) {
        return route.fulfill({ status: 400, json: { code: '42703', message: 'column exercises.photo_path does not exist' } })
      }
      return route.fulfill({ json: active })
    }
    await route.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/workout_routines?*', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/workout_sets*', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      const payload = request.postDataJSON()
      for (const row of Array.isArray(payload) ? payload : [payload]) {
        active.workout_sets.push({ ...row, id: 'set-' + row.set_number, exercise, weight_kg: row.weight_kg ?? null, completed: false, is_warmup: false })
      }
    }
    if (request.method() === 'PATCH') {
      const updatedId = new URL(request.url()).searchParams.get('id').slice(3)
      active.workout_sets = active.workout_sets.map((set) => set.id === updatedId ? { ...set, ...request.postDataJSON() } : set)
      return route.fulfill({ json: { id: updatedId } })
    }
    await route.fulfill({ status: 204 })
  })
  await page.goto('/workouts')
  await page.getByRole('button', { name: 'Iniciar treino vazio' }).click()
  await expect(page).toHaveURL('/workouts/active/quick-test')
  await expect(page.getByRole('heading', { name: 'Treino ativo' })).toBeVisible()
  await expect(page.getByText(/Treino vazio/)).toBeVisible()
  expect(active.routine_id).toBeNull()
  expect(active.workout_sets).toHaveLength(0)

  await page.getByRole('button', { name: 'Adicionar exercício', exact: true }).click()
  await page.getByRole('button', { name: /Supino salvo/ }).filter({ hasText: 'Supino salvo' }).click()
  const reps = page.getByLabel('Repetições')
  await expect(reps.first()).toHaveValue('')
  await reps.first().fill('8')
  await page.getByRole('button', { name: 'Adicionar série' }).click()
  await expect(reps).toHaveCount(4)
  await expect(reps.last()).toHaveValue('')

  const rest = page.getByRole('button', { name: /^Descanso entre séries,/ })
  await rest.click()
  const restChoices = page.getByRole('dialog', { name: 'Descanso entre séries' })
  await expect(restChoices.getByRole('option', { name: '30 s', exact: true })).toBeVisible()
  await expect(restChoices.getByRole('option', { selected: true })).toHaveText('1 min 30 s')
  await restChoices.getByRole('option', { name: '5 min', exact: true }).click()
  await restChoices.getByRole('button', { name: 'Aplicar descanso' }).click()
  await page.reload()
  await expect(rest).toHaveAccessibleName('Descanso entre séries, 5 min')

  const types = [['Aquecimento', 'warmup', true], ['Preparatória', 'preparatory', true], ['Drop-set', 'drop_set', false], ['Bi-set', 'bi_set', false]]
  for (const [index, [label, type, warmup]] of types.entries()) {
    const row = page.getByRole('button', { name: 'Remover série ' + (index + 1) }).locator('..')
    await row.getByRole('button', { name: /^Tipo da série/ }).click()
    await page.getByRole('dialog', { name: 'Tipo da série' }).getByRole('button', { name: label, exact: true }).click()
    await expect.poll(() => active.workout_sets[index]).toMatchObject({ set_type: type, is_warmup: warmup })
    await page.reload()
    await expect(row.getByRole('button', { name: 'Tipo da série, ' + label, exact: true })).toBeVisible()
    await row.getByLabel('Repetições').fill('8')
    await row.getByRole('button', { name: 'Marcar série como concluída', exact: true }).click()
    const skip = page.getByRole('button', { name: /Pular descanso/ })
    await expect(skip).toBeVisible()
    await expect(page.getByText(/^(05:00|04:5[6-9])$/)).toBeVisible()
    await skip.click()
  }

  await page.getByRole('button', { name: 'Finalizar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Revisar treino' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao treino' }).click()
  await page.getByRole('button', { name: 'Descartar treino', exact: true }).click()
  const discard = page.getByRole('dialog', { name: 'Descartar este treino?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page).toHaveURL('/workouts/active/quick-test')
})

test('starting a saved routine leaves reps blank even when the prior session had reps', async ({ page }) => {
  let sets = []
  await page.route('**/rest/v1/workout_routines?*', (route) => route.fulfill({
    json: new URL(route.request().url()).searchParams.has('id') ? routine : [routine],
  }))
  await page.route('**/rest/v1/rpc/previous_sets', (route) => route.fulfill({
    json: [{ exercise_id: exercise.id, set_number: 1, weight_kg: 25, reps: 12, is_warmup: false }],
  }))
  await page.route('**/rest/v1/workouts?*', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') return route.fulfill({ json: { id: 'planned-test' } })
    const url = new URL(request.url())
    await route.fulfill({ json: url.searchParams.has('id') ? {
      id: 'planned-test', name: routine.name, routine_id: routine.id, started_at: new Date().toISOString(),
      ended_at: null, paused_seconds: 0, paused_at: null, workout_sets: sets,
    } : [] })
  })
  await page.route('**/rest/v1/workout_sets*', async (route) => {
    sets = route.request().postDataJSON().map((row) => ({ ...row, id: 'planned-' + row.set_number, exercise, completed: false, is_warmup: false }))
    await route.fulfill({ status: 204 })
  })
  await page.goto('/workouts')
  await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click()
  await expect(page).toHaveURL('/workouts/active/planned-test')
  await expect(page.getByLabel('Repetições').first()).toHaveValue('')
  await expect(page.getByLabel('Peso em kg').first()).toHaveValue('25')
  await expect(page.getByText('25kg × 12')).toBeVisible()
  expect(sets).toHaveLength(3)
  expect(sets.every((set) => set.reps === null)).toBe(true)
})
