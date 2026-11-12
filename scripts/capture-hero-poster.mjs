/**
 * Captures the landing hero's poster from the real live scenes, the city
 * and the course side by side (stacked for the portrait frame), and writes
 * the WebP files under public/hero that the page paints before any script
 * runs. The page is opened with ?hero=still, which holds both scenes on
 * their opening tick, the very frame each one shows first when it fades
 * in. Each window is exactly one poster frame, and at any other size the
 * live scenes crop and scale their shots the way the page crops the
 * poster, so the poster and the live scene line up. Re-run it whenever
 * either scene, a hero file, the cameras or the hero's text panel change.
 *
 *   npm run build
 *   npx next start -p 3100
 *   npm run hero:poster
 *
 * Options, all optional: --url (default http://127.0.0.1:3100), --chromium
 * (a Chromium binary; Playwright's own is used when left out), --settle 4
 * (seconds the scenes settle once shown), --quality medium, --out
 * public/hero and --only wide, --only standard or --only portrait. It
 * needs a production build, Playwright and sharp (which comes with Next).
 * Chromium draws with its software renderer, so every machine captures
 * the same picture; it is slow, so expect a few minutes.
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
const settle = Number(args.settle ?? 4) * 1000;
const out = args.out ?? 'public/hero';
/** The quality the poster is drawn at. Medium matches what most visitors see once the scene goes live. */
const quality = args.quality ?? 'medium';
/** Captures only the wide, the 4:3 or the portrait frames when set. */
const only = args.only ?? null;

/** Everything in the hero over the scenes: the text panel and the corner cards. The line between the scenes stays. */
const HIDE = '[data-hero-content], [data-hero-panels] { visibility: hidden !important; }';

/**
 * On a phone the text panel takes about 60% of the hero's height, far more
 * than in the wide capture window, so the portrait frame is shot with the
 * panel stretched to that share. That frame composes its shots around a
 * panel of this size, so the SUV and the runner sit above and below where
 * a phone's panel will be.
 */
const PHONE_PANEL = '[data-hero-content] { min-height: 60%; }';

/**
 * Checks that the page composes its scenes for the frame being shot and
 * that the hero and its text panel still measure what that frame says
 * (src/render/hero/stage/posterFrame.ts). The live scenes compose every
 * window's shot from those numbers, so a stale frame would make the live
 * scene and its poster drift apart.
 */
async function checkFrame(page, kind) {
  const found = await page.evaluate(() => {
    const frame = JSON.parse(document.querySelector('[data-hero-frame]')?.getAttribute('data-hero-frame') ?? 'null');
    const hero = document.querySelector('section[aria-labelledby="hero-title"]').getBoundingClientRect();
    const p = document.querySelector('[data-hero-content]').getBoundingClientRect();
    return { frame, hero: [hero.width, hero.height], panel: [p.left - hero.left, p.top - hero.top, p.width, p.height] };
  });
  const f = found.frame;
  const want = f ? [f.width, f.height, f.panel.x, f.panel.y, f.panel.w, f.panel.h] : [];
  const got = [...found.hero, ...found.panel];
  if (!f || f.kind !== kind || want.some((v, i) => Math.abs(v - got[i]) > 1.5)) {
    throw new Error(`The ${kind} poster frame is out of date. The page measures ${JSON.stringify(got.map(Math.round))}, the frame says ${JSON.stringify(f)}.`);
  }
}

/** Opens the hero in a window of this size and returns a PNG of the scenes alone, held on their opening frame. */
async function capture(browser, kind, width, height, scale, css = '') {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, locale: 'en-US' });
  await page.goto(`${url}/?quality=${quality}&hero=still`, { waitUntil: 'load' });
  await page.waitForSelector('[data-hero-shown~="drive"][data-hero-shown~="run"]', { state: 'attached', timeout: 10 * 60_000 });
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate(() => document.fonts.ready);
  await checkFrame(page, kind);
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
    const wide = only && only !== 'wide' ? null : await capture(browser, 'wide', 1920, 1128, 4 / 3);
    for (const w of wide ? [2560, 1920, 1280] : []) {
      const file = join(out, `poster-${w}.webp`);
      const info = await sharp(wide).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
      console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
    }
    // 4:3 for squarer windows: a 1440 x 1080 hero at 4/3 scale gives a 1920 px frame.
    const standard = only && only !== 'standard' ? null : await capture(browser, 'standard', 1440, 1128, 4 / 3);
    for (const w of standard ? [1920, 1280] : []) {
      const file = join(out, `poster-4x3-${w}.webp`);
      const info = await sharp(standard).resize({ width: w }).webp({ quality: 72, effort: 6 }).toFile(file);
      console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
    }
    if (only && only !== 'portrait') return;
    // Portrait for phones and tablets. The window is just wide enough for the live scene to run (LIVE_MIN_WIDTH)
    // and tall like a phone, and the frame is scaled to 900 x 1600: the shot depends only on the shape.
    const tall = await capture(browser, 'portrait', 1024, 1868, 1, PHONE_PANEL);
    const file = join(out, 'poster-portrait.webp');
    const info = await sharp(tall).resize({ width: 900 }).webp({ quality: 70, effort: 6 }).toFile(file);
    console.log(`${file}: ${info.width} x ${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}

await main();
