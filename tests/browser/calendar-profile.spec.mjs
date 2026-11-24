import { expect, test } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'

test.use({ timezoneId: 'America/Sao_Paulo' })

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
    if (url.pathname.endsWith('/functions/v1/google-calendar-create-event')) {
      return route.fulfill({ status: 409, json: { error: 'not_connected' } })
    }
    let body = []
    if (url.pathname.includes('/storage/v1/object/avatars/')) body = { Key: `avatars/${userId}/profile.jpg` }
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

test('profile validates, uploads and replaces a photo', async ({ page }) => {
  await page.goto('/profile')
  const encoded = await page.evaluate(() => document.createElement('canvas').toDataURL('image/png').split(',')[1])
  const photo = Buffer.from(encoded, 'base64')
  await page.route('https://*.supabase.co/storage/v1/object/public/avatars/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: photo }))
  const input = page.getByLabel('Adicionar foto', { exact: true })
  await input.setInputFiles({ name: 'foto.txt', mimeType: 'text/plain', buffer: Buffer.from('arquivo') })
  await expect(page.getByRole('alert')).toContainText('Escolha uma foto JPG, PNG ou WebP')

  const upload = page.waitForRequest((req) => req.url().includes('/storage/v1/object/avatars/') && req.method() === 'POST')
  await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: photo })
  const request = await upload
  expect(new URL(request.url()).pathname).toBe(`/storage/v1/object/avatars/${userId}/profile.jpg`)
  expect(request.headers()['x-upsert']).toBe('true')

  const avatar = page.getByRole('button', { name: 'Perfil' }).locator('img')
  await expect(avatar).toHaveAttribute('src', /profile\.jpg\?v=/)
  await expect(avatar).toHaveJSProperty('naturalWidth', 300)
  const firstUrl = await avatar.getAttribute('src')
  await page.getByLabel('Trocar foto', { exact: true }).setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: photo })
  await expect(avatar).not.toHaveAttribute('src', firstUrl)
  await page.reload()
  await expect(avatar).toHaveAttribute('src', /profile\.jpg\?v=/)
})

test('weekly habits keep long names and seven days inside the card on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const name = 'Ler vinte páginas e registrar o que aprendi'
  await page.route('https://*.supabase.co/rest/v1/habits**', (route) => route.fulfill({ json: [{
    id: 'read-habit', name, category: 'mindfulness', weekdays: [0, 1, 2, 3, 4, 5, 6],
    reminder_time: '17:45:00', created_at: '2025-01-01T12:00:00.000Z',
  }] }))
  await page.goto('/routine?tab=habits')
  await page.getByRole('tab', { name: 'Semanal' }).click()
  const habit = page.getByRole('button', { name: `Editar ${name}`, exact: true })
  await expect(habit).toBeVisible()
  const row = habit.locator('..')
  await expect(row.getByRole('button')).toHaveCount(8)
  expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('calendar shows and reschedules tasks without displaying habits', async ({ page }) => {
  const task = { id: 'work-task', title: 'Trabalhar', due_at: '2026-11-30T22:00:00.000Z',
    category: 'work', completed_at: null, remind_minutes_before: 10, notes: null }
  const habit = { id: 'read-habit', name: 'Ler', category: 'mindfulness', weekdays: [1],
    reminder_time: '17:45:00', created_at: '2026-11-24T12:00:00.000Z' }
  await page.route('https://*.supabase.co/rest/v1/tasks**', (route) => {
    if (route.request().method() === 'PATCH') Object.assign(task, route.request().postDataJSON())
    const url = new URL(route.request().url())
    return route.fulfill({ json: url.searchParams.has('id') ? task : [task, { ...task, id: 'no-date', title: 'Sem prazo', due_at: null }] })
  })
  await page.route('https://*.supabase.co/rest/v1/habits**', (route) => route.fulfill({ json: [habit] }))
  await page.route('https://*.supabase.co/rest/v1/habit_logs**', (route) =>
    route.fulfill({ json: [{ habit_id: habit.id, log_date: '2026-11-30' }] }))

  await page.goto('/calendar?view=month&date=2026-11-30')
  await expect(page.getByRole('link', { name: /Trabalhar/ })).toContainText('19:00 · Tarefa')
  await expect(page.getByText('Ler', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Sem prazo')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Dia', exact: true }).click()
  await page.getByRole('button', { name: 'Próximo período' }).click()
  await expect(page.getByText('Nenhum compromisso neste dia.')).toBeVisible()
  await page.getByRole('button', { name: 'Período anterior' }).click()
  await page.goto('/calendar?view=week&date=2026-11-30')
  await page.getByRole('link', { name: /Trabalhar/ }).click()
  await expect(page.getByRole('heading', { name: 'Editar tarefa' })).toBeVisible()
  await expect(page.getByPlaceholder('Ex.: Revisar os documentos do projeto')).toHaveValue('Trabalhar')
  await page.getByRole('button', { name: 'Tarde (14:00)' }).click()
  await page.getByRole('button', { name: 'Salvar tarefa' }).click()
  await expect(page).toHaveURL(/routine/)
  await page.goBack()
  await expect(page).toHaveURL(/calendar/)
  await expect(page.getByRole('link', { name: /Trabalhar/ })).toContainText('14:00 · Tarefa')
})

test('connected calendar reads Google events and sends new events to the same agenda', async ({ page }) => {
  const received = []
  const syncOffsets = []
  const googleEvents = [{ id: 'google-original', summary: 'Feriado no Google', calendarName: 'Refeições', start: { date: '2026-11-24' },
    end: { date: '2026-11-25' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=sample' }]
  await page.route('https://*.supabase.co/rest/v1/google_tokens**', (route) =>
    route.fulfill({ json: { user_id: userId, updated_at: '2026-11-24T12:00:00Z' } }))
  await page.route('https://*.supabase.co/functions/v1/google-calendar-create-event', async (route) => {
    const request = route.request().postDataJSON()
    if (request.action === 'list') return route.fulfill({ json: { events: googleEvents } })
    if (request.action === 'sync') {
      syncOffsets.push(request.offset)
      return route.fulfill({ json: { sent: 1, failed: 0, next: request.offset === 0 ? 15 : null } })
    }
    received.push(request)
    googleEvents.push({ id: 'google-new', summary: request.title, start: { dateTime: request.start },
      end: { dateTime: '2026-11-24T13:00:00Z' } })
    return route.fulfill({ json: { id: 'google-new' } })
  })
  await page.goto('/profile?tab=connections')
  await page.getByRole('button', { name: /Google Agenda/ }).click()
  await expect(page.getByRole('button', { name: 'Reconectar Google Agenda' })).toBeVisible()
  await page.getByRole('button', { name: 'Sincronizar planejamento' }).click()
  await expect(page.getByRole('status')).toContainText('2 novos itens enviados.')
  expect(syncOffsets).toEqual([0, 15])
  await page.goto('/calendar?view=day&date=2026-11-24')
  await expect(page.getByRole('link', { name: /Feriado no Google/ })).toContainText('Dia inteiro · Google Agenda · Refeições')
  await page.getByRole('link', { name: 'Novo evento' }).click()
  await page.getByLabel('Título do evento').fill('Enviado ao Google')
  await page.getByRole('button', { name: 'Salvar evento' }).click()
  await expect(page.getByRole('link', { name: /Enviado ao Google/ })).toContainText('09:00–10:00 · Google Agenda')
  expect(received).toHaveLength(1)
  expect(received[0]).toMatchObject({ title: 'Enviado ao Google', start: '2026-11-24T12:00:00.000Z', reminderMinutes: 10 })
})
