import { expect, test } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sb-psjuvnsgelfreckmmtky-auth-token', JSON.stringify({
      access_token: 'test-session', refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id: userId, email: 'test@example.test' },
    }))
  }, { userId })
  const profile = { id: userId, onboarding_completed: true, enabled_modules: ['calendar', 'habits', 'workouts'],
    display_name: 'Ana', username: 'ana', xp: 145, theme: 'dark', language: 'pt-BR', currency: 'BRL' }
  const events = []
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    let body = []
    if (url.pathname.endsWith('/profiles')) {
      if (request.method() === 'PATCH') Object.assign(profile, request.postDataJSON())
      body = profile
    }
    if (url.pathname.endsWith('/calendar_events')) {
      if (request.method() === 'POST') events.push({ id: 'test-event', ...request.postDataJSON() })
      if (request.method() === 'PATCH') Object.assign(events[0], request.postDataJSON())
      body = url.searchParams.has('id') ? events[0] : events.filter((event) => !event.deleted_at)
    }
    await route.fulfill({ json: body })
  })
})

test('calendar switches periods and saves an event on the selected day', async ({ page }) => {
  await page.goto('/calendar?date=2026-11-24')
  await expect(page.getByRole('tab', { name: 'Mês', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Semana' }).click()
  await expect(page.getByRole('heading', { name: 'Agenda da semana' })).toBeVisible()
  await page.getByRole('tab', { name: 'Dia', exact: true }).click()
  await page.getByRole('link', { name: 'Novo evento' }).click()
  await expect(page.getByLabel('Data de início')).toHaveValue('2026-11-24')
  await page.getByLabel('Título do evento').fill('Treino de corrida')
  await page.getByRole('button', { name: 'Saúde' }).click()
  await page.getByRole('button', { name: 'Salvar evento' }).click()
  const event = page.getByRole('link', { name: /Treino de corrida/ })
  await expect(event).toContainText('09:00 · Saúde')
  await event.click()
  await expect(page.getByLabel('Título do evento')).toHaveValue('Treino de corrida')
  await page.getByLabel('Hora de término').fill('08:00')
  await page.getByRole('button', { name: 'Salvar evento' }).click()
  await expect(page.getByRole('alert')).toContainText('término depois do início')
  await page.getByLabel('Hora de término').fill('10:00')
  await page.getByRole('button', { name: 'Salvar evento' }).click()
  await expect(event).toContainText('09:00–10:00')
  await event.click()
  await page.getByRole('button', { name: 'Excluir evento' }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await expect(page.getByText('Nenhum compromisso neste dia.')).toBeVisible()
})

test('profile persists the theme and the header keeps the friends action', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar amigos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pesquisar', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Tema claro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tema claro' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Tema escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
