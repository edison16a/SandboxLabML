import { expect, test, type Worker } from '@playwright/test';

declare global {
  interface Window {
    /** Every WebGL context the page created, in order, recorded by the init script below. */
    __glContexts?: Array<WebGLRenderingContext | WebGL2RenderingContext>;
  }
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
    await expect(page.locator('[data-hero-scene]')).toHaveCount(0);
    expect(workers).toHaveLength(0);
    await context.close();
  });

  test('goes live on a desktop and lets go of its worker and WebGL contexts when you leave', async ({ page }) => {
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
    page.on('worker', (w) => workers.push(w));
    await page.goto('/?quality=low');

    // The car scene comes up over the poster, driven by one replay worker.
    await expect(page.locator('[data-hero-scene="car"]')).toBeAttached({ timeout: 240_000 });
    await expect(page.locator('[data-hero-panels]')).toContainText('Car brain');
    expect(workers).toHaveLength(1);
    const heroWorker = workers[0];
    const closed = new Promise<void>((resolve) => heroWorker.once('close', () => resolve()));
    // The hero's scenes draw on canvases in the page. Off-page contexts belong to libraries that keep one for the
    // whole visit (the text renderer measures glyphs on one), so they are not the hero's to release.
    const heroContexts = await page.evaluate(() => (window.__glContexts ?? []).flatMap((c, i) => (c.canvas instanceof HTMLCanvasElement && c.canvas.isConnected ? [i] : [])));
    expect(heroContexts.length).toBeGreaterThanOrEqual(1);

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
