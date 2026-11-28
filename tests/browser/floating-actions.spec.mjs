import { test, expect } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    localStorage.setItem('sb-psjuvnsgelfreckmmtky-auth-token', JSON.stringify({
      access_token: 'test-session', refresh_token: 'test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer', user: { id: userId, email: 'test@example.test' },
    }))
  }, { userId })

  const rules = []
  const transactions = []
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const name = url.pathname.split('/').at(-1)
    const method = req.method()
    let body = []
    if (name === 'profiles') body = { id: userId, onboarding_completed: true, enabled_modules: ['workouts', 'assistant', 'tasks', 'habits', 'finance', 'calendar'] }
    if (name === 'user_settings') body = { monthly_income: 2000 }
    if (name === 'workout_routines') body = [{ id: 'routine', name: 'Minhas séries', focus: '', tags: [], routine_exercises: [] }]
    if (name === 'workouts' && url.searchParams.getAll('ended_at').some((value) => value.startsWith('gte.'))) {
      const date = new Date().toISOString()
      body = [{ id: 'ride', name: 'Pedal da manhã', activity_category: 'Ciclismo', started_at: date, ended_at: date, paused_seconds: 0, workout_sets: [] }]
    }
    if (name === 'finance_recurring') {
      if (method === 'POST') {
        rules.push(req.postDataJSON())
        return route.fulfill({ status: 201 })
      }
      body = rules
    }
    if (name === 'sync_finance_recurring') {
      for (const rule of rules) {
        if (!transactions.some(({ id }) => id === rule.id)) transactions.push({
          ...rule, title: rule.description, occurred_on: rule.starts_on, is_recurring: true, source: 'app',
        })
      }
    }
    if (name === 'cancel_finance_recurring') {
      rules.splice(rules.findIndex((rule) => rule.id === req.postDataJSON().rule_id), 1)
    }
    if (name === 'transactions') body = transactions
    await route.fulfill({ json: body })
  })
})

test('shows recorded workouts by day and opens both paths for creating a routine', async ({ page }) => {
  await page.goto('/workouts')
  await expect(page.getByRole('group', { name: 'Dias da semana' }).getByRole('button')).toHaveCount(7)
  await expect(page.getByRole('list', { name: 'Treinos registrados no dia' }).getByRole('link', { name: /Pedal da manhã/ })).toHaveAttribute('href', '/workouts/view/ride')
  await expect(page.getByRole('link', { name: 'Pré-visualizar Minhas séries' })).toHaveCSS('text-decoration-line', 'none')
  await expect(page.getByLabel('Assistente de IA')).toHaveCount(0)
  const create = page.getByRole('button', { name: 'Criar rotina' })
  expect(await create.evaluate((button) => getComputedStyle(button.parentElement).position)).toBe('fixed')
  await create.click()
  await page.getByRole('link', { name: /Montar minha rotina/ }).click()
  await expect(page).toHaveURL('/workouts/routines/new')
  await page.goto('/workouts')
  await page.getByRole('button', { name: 'Criar rotina' }).click()
  await page.getByRole('link', { name: /Montar com o Neural/ }).click()
  await expect(page.getByRole('textbox', { name: 'Mensagem para o Neural' })).toHaveValue(/montar uma rotina/)
})

test('highlights every trained day even when a different day is selected', async ({ page }) => {
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7)
  monday.setHours(12, 0, 0, 0)
  const wednesday = new Date(monday)
  wednesday.setDate(monday.getDate() + 2)
  await page.route('**/rest/v1/workouts?*', async (route) => {
    const url = new URL(route.request().url())
    const filter = url.searchParams.getAll('ended_at')
    if (!filter.some((value) => value.startsWith('gte.'))) return route.fallback()
    const rows = [
      { id: 'walk', name: 'Caminhada no parque', activity_category: 'Caminhada', ended_at: monday.toISOString() },
      { id: 'run', name: 'Corrida curta', activity_category: 'Corrida', ended_at: wednesday.toISOString() },
    ].filter((row) => filter.every((bound) => bound.startsWith('gte.') ? row.ended_at >= bound.slice(4)
      : !bound.startsWith('lt.') || row.ended_at < bound.slice(3)))
      .map((row) => ({ ...row, started_at: row.ended_at, paused_seconds: 0, workout_sets: [] }))
    return route.fulfill({ json: rows })
  })
  await page.goto('/workouts')
  const days = page.getByRole('group', { name: 'Dias da semana' })
  const trained = days.getByRole('button', { name: /, com treino$/ })
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(trained).toHaveCount(2)
  await expect(page.getByText('2 dias com treino na semana')).toBeVisible()
  await trained.first().click()
  await expect(trained.last()).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('list', { name: 'Treinos registrados no dia' }).getByRole('link')).toHaveText(/Caminhada no parque/)
  await days.getByRole('button', { name: /, sem treino registrado$/ }).first().click()
  await expect(page.getByText('Nenhum treino registrado neste dia.')).toBeVisible()
  await expect(trained).toHaveCount(2)
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(trained).toHaveCount(0)
  await expect(page.getByText('0 dias com treino na semana')).toBeVisible()
})

test('adds and cancels a subscription from the Finance floating button', async ({ page }) => {
  await page.goto('/finance')
  await page.getByRole('button', { name: 'Adicionar em Finanças' }).click()
  await page.getByRole('button', { name: /Nova recorrência/ }).click()
  const form = page.getByRole('dialog', { name: 'Nova recorrência' })
  await form.getByLabel('Descrição').fill('Música mensal')
  await form.getByLabel('Valor da recorrência').fill('2590')
  await form.getByRole('button', { name: 'Salvar recorrência' }).click()
  await expect(page.getByRole('heading', { name: 'Recorrências' })).toBeVisible()
  await expect(page.getByText('Música mensal', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar recorrência de Música mensal' }).click()
  await page.getByRole('dialog', { name: 'Cancelar recorrência?' }).getByRole('button', { name: 'Cancelar recorrência', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recorrências' })).toHaveCount(0)
  await expect(page.getByText('Música mensal', { exact: true })).toBeVisible()
})

test('opens task, habit and calendar creation from fixed buttons', async ({ page }) => {
  await page.goto('/routine?tab=tasks')
  const task = page.getByRole('link', { name: 'Nova tarefa' })
  expect(await task.evaluate((button) => getComputedStyle(button.parentElement).position)).toBe('fixed')
  await task.click()
  await expect(page).toHaveURL('/tasks/new')

  await page.goto('/routine?tab=habits')
  await page.getByRole('button', { name: 'Novo hábito' }).click()
  await expect(page.getByRole('dialog', { name: 'Novo hábito' }).getByLabel('Nome do hábito')).toBeVisible()

  await page.goto('/calendar?date=2026-11-28')
  await page.getByRole('link', { name: 'Novo evento' }).click()
  await expect(page).toHaveURL(/\/calendar\/new\?date=2026-11-28/)
})
