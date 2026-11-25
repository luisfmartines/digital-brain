import { expect, test } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const weekVolume = Array.from({ length: 7 }, (_, index) => ({
  date: '2026-11-' + (23 + index),
  volume: index === 1 ? 3088 : 0,
  workouts: index === 1 ? 1 : 0,
}))


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
    if (url.pathname.endsWith('/functions/v1/public-profile') && request.postDataJSON()?.action === 'activity') {
      return route.fulfill({ json: { workoutCount: 0, followers: 0, following: 0, weekVolume, photos: [], workouts: [], posts: [] } })
    }
    let body = []
    if (url.pathname.includes('/storage/v1/object/avatars/')) body = { Key: `avatars/${userId}/profile.jpg` }
    if (url.pathname.endsWith('/profiles')) {
      if (request.method() === 'PATCH') Object.assign(profile, request.postDataJSON())
      body = url.searchParams.get('id')?.startsWith('in.') ? [profile] : profile
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
  const encoded = await page.evaluate(() => {
    const stamp = document.createElement('canvas')
    const paint = stamp.getContext('2d')
    paint.fillStyle = '#b32b46'
    paint.fillRect(0, 0, 120, stamp.height)
    paint.fillStyle = '#165c83'
    paint.fillRect(120, 0, stamp.width - 120, stamp.height)
    return stamp.toDataURL('image/png').split(',')[1]
  })
  const photo = Buffer.from(encoded, 'base64')
  await page.route('https://*.supabase.co/storage/v1/object/public/avatars/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: photo }))
  const addPhoto = page.getByRole('button', { name: 'Adicionar foto', exact: true })
  const sources = page.getByRole('dialog', { name: 'Foto do perfil' })
  await addPhoto.click()
  const firstGallery = page.waitForEvent('filechooser')
  await sources.getByRole('button', { name: 'Escolher da galeria' }).click()
  await (await firstGallery).setFiles({ name: 'foto.txt', mimeType: 'text/plain', buffer: Buffer.from('arquivo') })
  await expect(page.getByRole('alert')).toContainText('Escolha uma foto JPG, PNG ou WebP')

  const upload = page.waitForRequest((req) => req.url().includes('/storage/v1/object/avatars/') && req.method() === 'POST')
  await addPhoto.click()
  const camera = page.waitForEvent('filechooser')
  await sources.getByRole('button', { name: 'Usar câmera' }).click()
  const capture = await camera
  expect(await capture.element().getAttribute('capture')).toBe('user')
  await capture.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: photo })
  const crop = page.getByRole('dialog', { name: 'Ajustar foto do perfil' })
  const canvas = crop.getByLabel('Enquadramento da foto do perfil')
  await expect(canvas).toHaveCSS('border-radius', '50%')
  const original = await canvas.evaluate((element) => element.toDataURL())
  await crop.getByLabel('Zoom').press('ArrowRight')
  await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).not.toBe(original)
  const zoomed = await canvas.evaluate((element) => element.toDataURL())
  await canvas.press('ArrowRight')
  await expect.poll(() => canvas.evaluate((element) => element.toDataURL())).not.toBe(zoomed)
  await crop.getByRole('button', { name: 'Salvar foto' }).click()
  const request = await upload
  expect(new URL(request.url()).pathname).toBe(`/storage/v1/object/avatars/${userId}/profile.jpg`)
  expect(request.headers()['x-upsert']).toBe('true')

  const avatar = page.getByRole('button', { name: 'Perfil', exact: true }).locator('img')
  await expect(avatar).toHaveAttribute('src', /profile\.jpg\?v=/)
  await expect(avatar).toHaveJSProperty('naturalWidth', 300)
  const firstUrl = await avatar.getAttribute('src')
  await page.getByRole('button', { name: 'Ampliar foto de perfil' }).click()
  const viewer = page.getByRole('dialog', { name: 'Foto de Ana' })
  await expect(viewer.getByRole('img')).toHaveCSS('border-radius', '50%')
  await viewer.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Trocar foto', exact: true }).click()
  const newGallery = page.waitForEvent('filechooser')
  await sources.getByRole('button', { name: 'Escolher da galeria' }).click()
  const gallery = await newGallery
  expect(await gallery.element().getAttribute('capture')).toBeNull()
  await gallery.setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: photo })
  await crop.getByRole('button', { name: 'Salvar foto' }).click()
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
    if (request.action === 'calendars') return route.fulfill({ json: { calendars: [
      { id: 'main', name: 'Principal', primary: true, writable: true },
      { id: 'meals@google.test', name: 'Refeições', writable: true },
      { id: 'holidays', name: 'Feriados', writable: false },
    ] } })
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
  await expect(page.getByRole('button', { name: 'Saúde', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^Calendário do Google,/ }).click()
  await page.getByRole('dialog', { name: 'Calendário do Google' }).getByRole('button', { name: 'Refeições' }).click()
  await expect(page.getByRole('option', { name: 'Feriados' })).toHaveCount(0)
  await page.getByLabel('Título do evento').fill('Enviado ao Google')
  await page.getByRole('button', { name: 'Salvar evento' }).click()
  await expect(page.getByRole('link', { name: /Enviado ao Google/ })).toContainText('09:00–10:00 · Google Agenda')
  expect(received).toHaveLength(1)
  expect(received[0]).toMatchObject({ title: 'Enviado ao Google', calendarId: 'meals@google.test', start: '2026-11-24T12:00:00.000Z', reminderMinutes: 10 })
})

test('another profile shows shared details and copies a workout routine', async ({ page }) => {
  const otherId = '22222222-2222-4222-8222-222222222222'
  const calls = []
  await page.route('https://*.supabase.co/functions/v1/public-profile', (route) => {
    const action = route.request().postDataJSON()
    calls.push(action)
    if (action.action === 'activity') return route.fulfill({ json: {
      workoutCount: 14, followers: 9, following: 6, weekVolume,
      photos: [{ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', name: 'Treino de força', at: '2026-11-24T17:00:00Z' }],
      workouts: [{ id: 'recent-workout', name: 'Treino recente A', ended_at: '2026-11-24T17:00:00Z', seconds: 1800, volume: 450,
        exercises: [{ name: 'Agachamento', sets: 3 }] }],
      posts: [{ id: 'recent-post', created_at: '2026-11-24T17:00:00Z', caption: 'Dia 100% concluído!' }],
    } })
    if (action.action === 'copy_workout') return route.fulfill({ json: { id: 'copied-workout' } })
    return route.fulfill({ json: action.action === 'copy' ? { id: 'copied-routine' } : {
      id: otherId, name: 'Ana', username: 'ana', avatar: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', level: 7, bio: 'Corro e treino força.', sharing: true, completion: 85,
      routines: [{ id: 'test-routine', name: 'Treino de força', exercises: [{ name: 'Agachamento', sets: 3, reps: 10 }] }],
    } })
  })
  await page.goto('/profiles/' + otherId)
  const volume = page.getByRole('region', { name: 'Volume', exact: true })
  await expect(volume).toContainText('3.088')
  await expect(volume.getByRole('button')).toHaveCount(7)
  await volume.getByRole('button', { name: /23 de nov.*0 kg/ }).click()
  await expect(volume).toContainText('nenhum treino')

  await expect(page.getByRole('heading', { name: 'Ana' })).toBeVisible()
  await expect(page.getByText('Nível 7')).toBeVisible()
  await expect(page.getByText('85%')).toBeVisible()
  await page.getByRole('button', { name: 'Ampliar foto de perfil' }).click()
  const viewer = page.getByRole('dialog', { name: 'Foto de Ana' })
  await expect(viewer.getByRole('img')).toHaveCSS('border-radius', '50%')
  await viewer.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByText('Seguidores', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ampliar foto de Treino de força' })).toBeVisible()
  await expect(page.getByText('Dia 100% concluído!')).toBeVisible()
  await page.getByRole('button', { name: /Treino de força.*1 exercício/ }).click()
  const routineDialog = page.getByRole('dialog', { name: 'Treino de força' })
  await expect(routineDialog.getByText('Agachamento')).toBeVisible()
  await routineDialog.getByRole('button', { name: 'Copiar rotina' }).click()
  await expect(page.getByRole('link', { name: 'Abrir rotina copiada' })).toHaveAttribute('href', '/workouts/routines/copied-routine/edit')
  await routineDialog.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Ver treino completo' }).click()
  const workoutDialog = page.getByRole('dialog', { name: 'Treino recente A' })
  await workoutDialog.getByRole('button', { name: 'Copiar como rotina' }).click()
  await expect(workoutDialog.getByRole('link', { name: 'Abrir rotina copiada' })).toHaveAttribute('href', '/workouts/routines/copied-workout/edit')
  expect(calls).toEqual(expect.arrayContaining([
    { action: 'read', id: otherId }, { action: 'activity', id: otherId },
    { action: 'copy', id: 'test-routine' }, { action: 'copy_workout', id: 'recent-workout' },
  ]))
})

test('home progress is left-aligned and the workout tabs share the full bar', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Progresso de hoje' })
  const percentage = card.getByText(/^\d+%$/)
  const caption = card.getByText('concluído hoje', { exact: true })
  await expect(card).toHaveCSS('text-align', 'left')
  await expect(percentage).toHaveCSS('font-style', 'normal')
  await expect(percentage).toHaveCSS('font-family', /Space Grotesk/)
  await expect(caption).toHaveCSS('font-style', 'normal')
  await expect(page.getByRole('heading', { name: /Olá, Ana/ })).toHaveCSS('font-style', 'italic')
  const [numberBox, captionBox] = await Promise.all([percentage.boundingBox(), caption.boundingBox()])
  expect(numberBox.x).toBeCloseTo(captionBox.x, 0)

  await page.goto('/workouts')
  const tabs = page.getByRole('tablist')
  const training = tabs.getByRole('tab', { name: 'Treinamento' })
  const ranking = tabs.getByRole('tab', { name: 'Classificação' })
  await expect(training).toHaveAttribute('aria-selected', 'true')
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    const [barBox, trainingBox, rankingBox] = await Promise.all([tabs.boundingBox(), training.boundingBox(), ranking.boundingBox()])
    expect(trainingBox.width).toBeCloseTo(rankingBox.width, 0)
    expect(trainingBox.y).toBeCloseTo(rankingBox.y, 0)
    expect(trainingBox.x - barBox.x).toBeCloseTo(barBox.x + barBox.width - rankingBox.x - rankingBox.width, 0)
  }
  await ranking.click()
  await expect(ranking).toHaveAttribute('aria-selected', 'true')
})

test('habit creation uses the theme picker and submits the chosen category', async ({ page }) => {
  await page.goto('/routine?tab=habits')
  await page.getByPlaceholder('Ex.: Ler por 20 minutos').fill('Caminhar depois do almoço')
  await page.getByRole('button', { name: /^Categoria do hábito,/ }).click()
  const choice = page.getByRole('dialog', { name: 'Categoria do hábito' })
  await choice.getByRole('button', { name: 'Condicionamento e Movimento' }).click()
  await expect(choice).toBeHidden()
  const request = page.waitForRequest((req) => new URL(req.url()).pathname.endsWith('/rest/v1/habits') && req.method() === 'POST')
  await page.getByRole('button', { name: 'Ativar hábito' }).click()
  expect((await request).postDataJSON()).toMatchObject({ name: 'Caminhar depois do almoço', category: 'fitness' })
})

test('own profile shows routines above the settings and its feed posts at the end', async ({ page }) => {
  await page.route('**/rest/v1/posts?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('user_id')).toBe('eq.' + userId)
    return route.fulfill({ json: [{
      id: 'own-post', user_id: userId, created_at: '2026-11-24T17:30:00Z', photo_url: null, caption: null,
      workout: { id: 'own-workout', name: 'Treino publicado', started_at: '2026-11-24T17:00:00Z',
        ended_at: '2026-11-24T17:30:00Z', paused_seconds: 0, workout_sets: [] },
    }] })
  })
  await page.goto('/profile')
  const volume = page.getByRole('region', { name: 'Volume', exact: true })
  await expect(volume).toContainText('Semana atual')
  await expect(volume).toContainText('3.088')
  await expect(volume.getByRole('button')).toHaveCount(7)
  const routines = await page.getByRole('heading', { name: 'Rotinas', exact: true }).boundingBox()
  const settings = await page.getByRole('heading', { name: 'Preferências' }).boundingBox()
  const deleteButton = await page.getByRole('button', { name: 'Excluir conta', exact: true }).boundingBox()
  const activity = page.getByRole('region', { name: 'Atividade recente' })
  expect(routines.y).toBeLessThan(settings.y)
  expect((await activity.boundingBox()).y).toBeGreaterThan(deleteButton.y + deleteButton.height)
  await expect(activity.getByRole('button', { name: 'Ver treino completo: Treino publicado' })).toBeVisible()
  await expect(activity.getByRole('button', { name: 'Comentários' })).toBeVisible()
})

test('account deletion requires explicit typed confirmation and signs out after success', async ({ page }) => {
  let calls = 0
  await page.route('**/functions/v1/delete-account', (route) => {
    calls++
    expect(route.request().postDataJSON()).toEqual({ confirmation: 'EXCLUIR' })
    return route.fulfill({ json: { deleted: true } })
  })
  await page.route('**/auth/v1/logout?*', (route) => route.fulfill({ status: 204 }))
  await page.goto('/profile')
  const signOut = await page.getByRole('button', { name: 'Sair da conta' }).boundingBox()
  const deleteButton = page.getByRole('button', { name: 'Excluir conta', exact: true })
  const deletion = await deleteButton.boundingBox()
  expect(deletion).toMatchObject({ width: signOut.width, height: signOut.height })
  await deleteButton.click()
  const dialog = page.getByRole('dialog', { name: 'Excluir sua conta?' })
  const confirm = dialog.getByRole('button', { name: 'Excluir permanentemente' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel('Digite EXCLUIR para confirmar').fill('excluir')
  await expect(confirm).toBeDisabled()
  expect(calls).toBe(0)
  await dialog.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR')
  await confirm.click()
  await expect(page).toHaveURL(/\/login$/)
  expect(calls).toBe(1)
})
