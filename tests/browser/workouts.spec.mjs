import { test, expect } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const exercise = { id: 'saved', name: 'Supino salvo', muscle_group: 'chest', equipment: 'barbell', user_id: userId }
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
  expect((await request).postDataJSON()[0].target_sets).toBe(4)
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
