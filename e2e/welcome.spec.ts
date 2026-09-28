import { expect, test } from '@playwright/test'

test('welcome page shows the public menu', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const accept = page.getByRole('button', { name: 'Accept' })
  if (await accept.isVisible().catch(() => false)) {
    await accept.click()
  }

  const nav = page.locator('.method-screen__nav')
  await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'The Method' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Login' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const color = await nav
    .getByRole('link', { name: 'Home' })
    .evaluate((element) => getComputedStyle(element).color)
  expect(color).toBe('rgb(255, 255, 255)')
})
