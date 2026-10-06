import { expect, test, type Page } from '@playwright/test';

interface Stats {
  drawCalls: number;
  triangles: number;
  instances: Record<string, number>;
}

/** The renderer publishes its counters on window.__sbl.stats twice a second. */
function stats(page: Page): Promise<Stats | null> {
  return page.evaluate(() => (window as unknown as { __sbl?: { stats: Stats } }).__sbl?.stats ?? null);
}

function instances(page: Page, key: string) {
  return async () => (await stats(page))?.instances?.[key] ?? -1;
}

/**
 * The Hide and Seek lab in a real browser on software WebGL. Low quality
 * keeps frames cheap; every check reads the renderer's own counters rather
 * than pixels.
 */
test('the grid shows 50 arenas, the inputs overlay draws rays and a click focuses an arena', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.hideseek', '1'));
  await page.goto('/lab/hide-seek?quality=low');
  await expect.poll(instances(page, 'arenas'), { timeout: 120_000 }).toBe(50);
  const grid = await stats(page);
  expect(grid?.drawCalls ?? Infinity).toBeLessThan(60);
  expect(grid?.triangles ?? Infinity).toBeLessThan(150_000);

  // Rays need a live round, so start training at 1x.
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 60_000 });
  await expect.poll(instances(page, 'rays'), { timeout: 30_000 }).toBe(0);
  await page.keyboard.press('i');
  await expect.poll(instances(page, 'rays'), { timeout: 90_000 }).toBeGreaterThan(200);
  await page.keyboard.press('i');
  await expect.poll(instances(page, 'rays'), { timeout: 60_000 }).toBe(0);

  // Fifty arenas lie 10 x 5 around the center, so a point a little right of center is on an arena, not a gap.
  const box = await page.getByTestId('hs-viewport').boundingBox();
  if (!box) throw new Error('viewport not found');
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await expect.poll(instances(page, 'showcase'), { timeout: 60_000 }).toBe(1);
  await expect(page.getByRole('button', { name: /All arenas/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(instances(page, 'showcase'), { timeout: 60_000 }).toBe(0);
});
