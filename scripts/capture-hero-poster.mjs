/**
 * Captures the landing hero's poster from the real racing scene and writes
 * the WebP files under public/hero that the page paints before any script
 * runs. Re-run it whenever the racing scene, the hero car or the camera
 * changes, so the poster still matches what fades in over it.
 *
 *   npm run build
 *   npx next start -p 3100
 *   npm run hero:poster
 *
 * Options, all optional: --url (default http://127.0.0.1:3100), --chromium
 * (a Chromium binary; Playwright's own is used when left out), --settle 9
 * (seconds the car drives before the shot), --quality medium and --out
 * public/hero. It needs a production build, Playwright and sharp (which
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

/** Everything in the hero except the scene: the scrim, the words and the corner cards. */
const HIDE = '[data-hero-scrim], [data-hero-content], [data-hero-panels] { visibility: hidden !important; }';

/** Opens the hero in a window of this size and returns a PNG of the scene alone, once the car has driven a while. */
async function capture(browser, width, height, scale) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'en-US' });
  await page.goto(`${url}/?quality=${quality}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-hero-scene="car"]', { state: 'attached', timeout: 10 * 60_000 });
  await page.addStyleTag({ content: HIDE });
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
    const wide = await capture(browser, 1920, 1128, 4 / 3);
    for (const w of [2560, 1920, 1280]) {
      const file = join(out, `poster-${w}.webp`);
      const info = await sharp(wide).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
      console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
    }
    // Portrait for phones. The window is wide enough for the live scene to run, and tall like a phone.
    const tall = await capture(browser, 900, 1648, 1);
    const file = join(out, 'poster-portrait.webp');
    const info = await sharp(tall).webp({ quality: 70, effort: 6 }).toFile(file);
    console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}

await main();
