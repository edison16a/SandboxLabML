import { expect, test, type Worker } from '@playwright/test';

declare global {
  interface Window {
    /** Every WebGL context the page created, in order, recorded by the init script below. */
    __glContexts?: Array<WebGLRenderingContext | WebGL2RenderingContext>;
  }
}

/**
 * Runs in the page: the hero text a corner card covers, as a list of the
 * covered lines. Text is measured by its line boxes rather than its block,
 * since a centered paragraph's block is far wider than its words. The
 * text panel itself counts too, so a card never sits on its edge.
 */
function cardsOverText(): string[] {
  const cards = [...document.querySelectorAll('[data-hero-card]')].map((c) => c.getBoundingClientRect());
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const covered: string[] = [];
  for (const el of document.querySelectorAll('[data-hero-content] > *')) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const boxes = el.tagName === 'P' || el.tagName === 'H1' ? [...range.getClientRects()] : [el.getBoundingClientRect()];
    if (boxes.some((b) => cards.some((c) => hit(b, c)))) covered.push(el.textContent || el.tagName);
  }
  const panel = document.querySelector('[data-hero-content]')?.getBoundingClientRect();
  if (panel && cards.some((c) => hit(panel, c))) covered.push('the text panel');
  return covered;
}

test.describe('Landing hero', () => {
  test.setTimeout(300_000);

  test('paints the poster first and keeps it for reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const workers: Worker[] = [];
    page.on('worker', (w) => workers.push(w));
    await page.goto('/');
    const poster = page.locator('section[aria-labelledby="hero-title"] img');
    await expect(poster).toHaveAttribute('src', /\/hero\/poster-\d+\.webp$/);
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    // Give the hero the time it would take to go live, then check it never did.
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-hero-shown]')).toHaveCount(0);
    expect(workers).toHaveLength(0);
    await context.close();
  });

  test('goes live on a desktop with both scenes in one canvas and lets go of its worker and context when you leave', async ({ page }) => {
    await page.addInitScript(() => {
      const contexts: Array<WebGLRenderingContext | WebGL2RenderingContext> = [];
      window.__glContexts = contexts;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        const ctx = (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
        if (ctx && (type === 'webgl2' || type === 'webgl') && !contexts.includes(ctx as WebGL2RenderingContext)) contexts.push(ctx as WebGL2RenderingContext);
        return ctx;
      } as typeof original;
      window.localStorage.setItem('sandboxlab.tour.racing', '1');
    });
    const workers: Worker[] = [];
    const gone = new Set<Worker>();
    page.on('worker', (w) => {
      workers.push(w);
      w.once('close', () => gone.add(w));
    });
    await page.goto('/?quality=low');

    // The car scene comes up over its half of the poster, driven by one replay worker. The worker that built the
    // hills and trees has finished and closed by the time the scene shows. The arena then joins it beside it.
    await expect(page.locator('[data-hero-shown~="car"]')).toBeAttached({ timeout: 240_000 });
    await expect(page.locator('[data-hero-panels]')).toContainText('Car brain');
    await expect.poll(() => workers.filter((w) => !gone.has(w)).length).toBe(1);
    await expect(page.locator('[data-hero-shown~="arena"]')).toBeAttached({ timeout: 240_000 });
    await expect(page.locator('[data-hero-panels]')).toContainText(/Hider brain|Seeker brain/);

    // On a small laptop the corner cards stay clear of the centered words and the button.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('[data-hero-panels]')).toBeVisible();
    await expect.poll(() => page.evaluate(cardsOverText)).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    const heroWorker = workers.find((w) => !gone.has(w)) as Worker;
    const closed = new Promise<void>((resolve) => heroWorker.once('close', () => resolve()));
    // Both scenes draw on one canvas in the page. Off-page contexts belong to libraries that keep one for the
    // whole visit (the text renderer measures glyphs on one), so they are not the hero's to release.
    const heroContexts = await page.evaluate(() => (window.__glContexts ?? []).flatMap((c, i) => (c.canvas instanceof HTMLCanvasElement && c.canvas.isConnected ? [i] : [])));
    expect(heroContexts).toHaveLength(1);

    await page.getByRole('link', { name: 'Go Train' }).click();
    await expect(page).toHaveURL(/\/lab\/racing$/);
    await closed;
    // Every context the hero drew with is lost once the lab is up: nothing of it lingers.
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => page.evaluate((ids) => ids.every((i) => window.__glContexts?.[i]?.isContextLost()), heroContexts), { timeout: 30_000 })
      .toBe(true);
  });
});
