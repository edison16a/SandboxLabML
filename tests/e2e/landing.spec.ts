import { expect, test, type Page, type Worker } from '@playwright/test';

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

/** Records every WebGL context the page makes and skips the lab walkthroughs. */
async function watchContexts(page: Page) {
  await page.addInitScript(() => {
    const contexts: Array<WebGLRenderingContext | WebGL2RenderingContext> = [];
    window.__glContexts = contexts;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      if (ctx && (type === 'webgl2' || type === 'webgl') && !contexts.includes(ctx as WebGL2RenderingContext)) contexts.push(ctx as WebGL2RenderingContext);
      return ctx;
    } as typeof original;
    for (const lab of ['driving', 'navigation']) window.localStorage.setItem(`sandboxlab.tour.${lab}`, '1');
  });
}

/** The runner card's clock, which only moves while the hero plays. */
const runnerClock = (page: Page) => page.locator('[data-hero-card="run"] [data-hero-detail]').textContent();

test.describe('Landing hero', () => {
  test.setTimeout(420_000);

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

  test('talks only about the two labs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Go Train' })).toHaveAttribute('href', '/lab/driving');
    await expect(page.locator('[data-hero-content]').getByRole('link', { name: 'Navigation' })).toHaveAttribute('href', '/lab/navigation');
    await expect(page.locator('[data-hero-content]').getByRole('link', { name: 'Studio' })).toHaveAttribute('href', '/studio');
    const words = await page.locator('section, footer').allTextContents();
    expect(words.join(' ')).not.toMatch(/racing|\blaps?\b|tracks?\b|hiders?|seekers?|hide and seek/i);
  });

  test('plays both trained brains live, pauses off screen, and lets go of its contexts when you leave', async ({ page }) => {
    await watchContexts(page);
    const workers: Worker[] = [];
    page.on('worker', (w) => workers.push(w));
    await page.goto('/?quality=low');

    // The city comes up over its half of the poster with the SUV's brain card, then the course beside it.
    await expect(page.locator('[data-hero-shown~="drive"]')).toBeAttached({ timeout: 300_000 });
    await expect(page.locator('[data-hero-card="drive"]')).toContainText('SUV brain');
    await expect(page.locator('[data-hero-card="drive"]')).toContainText(/\d+ km\/h/);
    await expect(page.locator('[data-hero-shown~="run"]')).toBeAttached({ timeout: 300_000 });
    await expect(page.locator('[data-hero-card="run"]')).toContainText('Runner brain');
    // Both simulations run on the page itself: no worker starts for the hero.
    expect(workers).toHaveLength(0);

    // Scrolled away, the scenes and their simulations stand still; back on screen, they carry on.
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    const held = await runnerClock(page);
    await page.waitForTimeout(6000);
    expect(await runnerClock(page)).toBe(held);
    await page.locator('section[aria-labelledby="hero-title"]').scrollIntoViewIfNeeded();
    await expect.poll(() => runnerClock(page), { timeout: 120_000 }).not.toBe(held);

    // On a small laptop the corner cards stay clear of the centered words and the button.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('[data-hero-panels]')).toBeVisible();
    await expect.poll(() => page.evaluate(cardsOverText)).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Each scene draws in a canvas of its own. Off-page contexts belong to libraries that keep one for the
    // whole visit (the text renderer measures glyphs on one), so they are not the hero's to release.
    const heroContexts = await page.evaluate(() => (window.__glContexts ?? []).flatMap((c, i) => (c.canvas instanceof HTMLCanvasElement && c.canvas.isConnected ? [i] : [])));
    expect(heroContexts).toHaveLength(2);

    await page.getByRole('link', { name: 'Go Train' }).click();
    await expect(page).toHaveURL(/\/lab\/driving$/);
    // Every context the hero drew with is lost once the lab is up: nothing of it lingers.
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => page.evaluate((ids) => ids.every((i) => window.__glContexts?.[i]?.isContextLost()), heroContexts), { timeout: 30_000 })
      .toBe(true);
  });
});
