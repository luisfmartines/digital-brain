import { expect, test } from '@playwright/test'

test('legal documents are public and connected to the sign-in screen', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Política de Privacidade' }).click()
  await expect(page).toHaveURL(/\/privacidade$/)
  await expect(page.getByRole('heading', { name: 'Política de Privacidade', level: 1 })).toBeVisible()
  await expect(page).toHaveTitle('Política de Privacidade | Digital Brain')
  await page.getByRole('navigation', { name: 'Nesta página' }).getByRole('link', { name: 'Seus direitos e contato' }).click()
  await expect(page).toHaveURL(/#direitos$/)
  await expect(page.getByRole('heading', { name: 'Seus direitos e contato' })).toBeInViewport()
  await expect(page.getByRole('link', { name: 'lfdmmartines2@gmail.com' })).toHaveAttribute('href', 'mailto:lfdmmartines2@gmail.com')
  await page.getByRole('navigation', { name: 'Documentos legais' }).getByRole('link', { name: 'Termos de Uso' }).click()
  await expect(page).toHaveTitle('Termos de Uso | Digital Brain')
  await expect(page.getByRole('heading', { name: 'Termos de Uso', level: 1 })).toBeInViewport()
})

test('terms and privacy sections can be loaded directly on mobile', async ({ page }) => {
  await page.goto('/termos-de-uso')
  await expect(page.getByRole('heading', { name: 'Termos de Uso', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'armazenamento e exclusão' }).click()
  await expect(page).toHaveURL(/\/privacidade#retencao$/)
  await expect(page.getByRole('heading', { name: 'Armazenamento, segurança e exclusão' })).toBeInViewport()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Armazenamento, segurança e exclusão' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
