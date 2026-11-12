import { expect, test, type Page, type Worker } from '@playwright/test';

declare global {
  interface Window {
    /** Every WebGL context the page created, in order, recorded by the init script below. */
    __glContexts?: Array<WebGLRenderingContext | WebGL2RenderingContext>;
    /** Draw calls made so far on any WebGL 2 context, counted by the same script. */
    __glDraws?: number;
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

/** Records every WebGL context the page makes, counts its draw calls, and skips the lab walkthroughs. */
async function watchContexts(page: Page) {
  await page.addInitScript(() => {
    const contexts: Array<WebGLRenderingContext | WebGL2RenderingContext> = [];
    window.__glContexts = contexts;
    window.__glDraws = 0;
    const proto = WebGL2RenderingContext.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const draw = proto[name];
      proto[name] = function (this: unknown, ...a: unknown[]) {
        window.__glDraws = (window.__glDraws ?? 0) + 1;
        return draw.apply(this, a);
      };
    }
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

/** Draw calls the page has made so far. */
const draws = (page: Page) => page.evaluate(() => window.__glDraws ?? 0);

/**
 * Waits until nothing has drawn for a few seconds. A frame already under
 * way when the hero left the screen can still land, and a software
 * renderer on a busy machine may take seconds over one.
 */
async function settleDrawing(page: Page): Promise<number> {
  let last = await draws(page);
  await expect
    .poll(
      async () => {
        const now = await draws(page);
        const still = now === last;
        last = now;
        return still;
      },
      { timeout: 90_000, intervals: [4000] },
    )
    .toBe(true);
  return last;
}

/** The poster frame the live scenes compose their shots for, or null when the hero frames itself. */
const posterFrame = async (page: Page) => JSON.parse((await page.locator('[data-hero-frame]').getAttribute('data-hero-frame')) ?? 'null') as { kind: string } | null;

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
    // The scenes are composed like the wide poster under them, so nothing jumps as they fade in.
    expect((await posterFrame(page))?.kind).toBe('wide');

    // Scrolled away, the scenes draw nothing and their simulations stand still; back on screen, they carry on.
    await page.locator('footer').scrollIntoViewIfNeeded();
    const drawn = await settleDrawing(page);
    const held = await runnerClock(page);
    await page.waitForTimeout(8000);
    expect(await draws(page)).toBe(drawn);
    expect(await runnerClock(page)).toBe(held);
    await page.locator('section[aria-labelledby="hero-title"]').scrollIntoViewIfNeeded();
    await expect.poll(() => draws(page), { timeout: 60_000 }).toBeGreaterThan(drawn);
    await expect.poll(() => runnerClock(page), { timeout: 120_000 }).not.toBe(held);

    // On a small laptop the corner cards stay clear of the centered words and the button.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('[data-hero-panels]')).toBeVisible();
    await expect.poll(() => page.evaluate(cardsOverText)).toEqual([]);
    // A 4:3 window gets the 4:3 poster, and the scenes follow it.
    await expect.poll(async () => (await posterFrame(page))?.kind).toBe('standard');
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
