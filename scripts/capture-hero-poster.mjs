/**
 * Captures the landing hero's poster from the real live scenes, the racing
 * scene and the arena side by side (stacked for the portrait frame), and
 * writes the WebP files under public/hero that the page paints before any
 * script runs. Re-run it whenever either scene, the hero car or the
 * cameras change, so the poster still matches what fades in over it.
 *
 *   npm run build
 *   npx next start -p 3100
 *   npm run hero:poster
 *
 * Options, all optional: --url (default http://127.0.0.1:3100), --chromium
 * (a Chromium binary; Playwright's own is used when left out), --settle 9
 * (seconds both scenes play before the shot), --quality medium, --out
 * public/hero and --only wide or --only portrait. It needs a production build, Playwright and sharp (which
 * comes with Next). Chromium draws with its software renderer, so every
 * machine captures the same picture; it is slow, so expect a few minutes.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null))
    .filter(Boolean),
);
const url = args.url ?? 'http://127.0.0.1:3100';
const settle = Number(args.settle ?? 9) * 1000;
const out = args.out ?? 'public/hero';
/** The quality the poster is drawn at. Medium matches what most visitors see once the scene goes live. */
const quality = args.quality ?? 'medium';
/** Captures only the wide or only the portrait frames when set. */
const only = args.only ?? null;

/** Everything in the hero over the scenes: the text panel and the corner cards. The line between the scenes stays. */
const HIDE = '[data-hero-content], [data-hero-panels] { visibility: hidden !important; }';

/**
 * On a phone the text panel takes about 60% of the hero's height, far more
 * than in the wide capture window, so the portrait frame is shot with the
 * panel stretched to that share. The scenes frame their subjects around
 * the panel, so the car and the players then sit above and below where a
 * phone's panel will be.
 */
const PHONE_PANEL = '[data-hero-content] { min-height: 60%; }';

/** Opens the hero in a window of this size and returns a PNG of the scenes alone, once both have played a while. */
async function capture(browser, width, height, scale, css = '') {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'en-US' });
  await page.goto(`${url}/?quality=${quality}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-hero-shown~="car"][data-hero-shown~="arena"]', { state: 'attached', timeout: 10 * 60_000 });
  await page.addStyleTag({ content: HIDE + css });
  await page.waitForTimeout(settle);
  const png = await page.locator('section[aria-labelledby="hero-title"]').screenshot({ timeout: 5 * 60_000 });
  await page.close();
  return png;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: args.chromium,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    await mkdir(out, { recursive: true });
    // Wide: a 1920 x 1080 window at 4/3 scale gives a 2560 px frame, scaled down for the smaller files.
    const wide = only === 'portrait' ? null : await capture(browser, 1920, 1128, 4 / 3);
    for (const w of wide ? [2560, 1920, 1280] : []) {
      const file = join(out, `poster-${w}.webp`);
      const info = await sharp(wide).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
      console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
    }
    if (only === 'wide') return;
    // Portrait for phones and tablets. The window is just wide enough for the live scene to run (LIVE_MIN_WIDTH)
    // and tall like a phone, and the frame is scaled to 900 x 1600: the shot depends only on the shape.
    const tall = await capture(browser, 1024, 1868, 1, PHONE_PANEL);
    const file = join(out, 'poster-portrait.webp');
    const info = await sharp(tall).resize({ width: 900 }).webp({ quality: 70, effort: 6 }).toFile(file);
    console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}

await main();
