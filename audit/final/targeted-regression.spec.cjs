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

test('booking has one main landmark containing its page heading', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100/book');
  const main = page.getByRole('main');
  await expect(main).toHaveCount(1);
  const title = main.getByRole('heading', { level: 1 });
  await expect(title).toBeVisible();

  if (await title.textContent() === 'Online booking is coming soon') return;
  const wizardTitle = main.getByRole('heading', { name: 'Your move details', level: 2 });
  await expect(wizardTitle).toBeVisible();
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = (heading) => heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size(title)).toBeGreaterThan(await size(wizardTitle));
  }
});
