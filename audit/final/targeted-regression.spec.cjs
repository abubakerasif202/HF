const { test, expect } = require('@playwright/test');

test.use({ browserName: 'chromium', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

test('mobile menu focus and process numbering regression', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Open menu' }).click();
  const startedAt = await page.evaluate(() => performance.now());
  await page.waitForFunction((started) => performance.now() - started >= 180, startedAt);
  const home = page.locator('#mobile-menu a[href="/"]').first();
  await expect(home).toBeFocused();

  await page.keyboard.press('Escape');
  const titles = await page.locator('.process-line > li h3').allTextContents();
  expect(titles).toHaveLength(5);
  expect(titles.every((title) => !/^\s*\d+[.)-]?\s/.test(title))).toBe(true);
  await expect(page.locator('.process-line > li > span')).toHaveText(['01', '02', '03', '04', '05']);
});
