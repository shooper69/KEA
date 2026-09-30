import { expect, test } from '@playwright/test'

async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const accept = page.getByRole('button', { name: 'Accept' })
  if (await accept.isVisible().catch(() => false)) {
    await accept.click()
  }
}

test('public support page renders', async ({ page }) => {
  await page.goto('/support')
  await expect(page.getByRole('heading', { name: 'Customer Support' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'team@kea.chat' })).toBeVisible()
})

test('public delete-account page renders', async ({ page }) => {
  await page.goto('/delete-account')
  await expect(page.getByRole('heading', { name: 'Delete my Kea data' })).toBeVisible()
})

test('public method page renders', async ({ page }) => {
  await page.goto('/method')
  await dismissCookieBanner(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('legal pages render', async ({ page }) => {
  await page.goto('/privacy-policy')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/terms-of-service')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/cookie-policy')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('login modal opens from welcome', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await dismissCookieBanner(page)
  await page.locator('.method-screen__nav').getByRole('button', { name: 'Login' }).click()
  await expect(page.locator('.auth-modal[role="dialog"]')).toBeVisible()
})
