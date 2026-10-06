/**
 * Renders the app icon SVG to the PNG sizes browsers and phones ask for.
 * Run once with `npm run icons` after changing assets/brand/app-icon.svg;
 * the outputs are committed under public/.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const svg = readFileSync(join(root, 'assets/brand/app-icon.svg'), 'utf8');
const sizes: Array<[number, string]> = [
  [32, 'public/favicon-32.png'],
  [180, 'public/apple-touch-icon.png'],
  [512, 'public/icon-512.png'],
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [size, out] of sizes) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('width="512" height="512"', `width="${size}" height="${size}"`);
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    writeFileSync(join(root, out), png);
    console.log(`wrote ${out}`);
  }
  await browser.close();
}

main();
