/**
 * The app's font family spelled out for a 2D canvas. A canvas does not
 * resolve CSS variables: it rejects a font string with var() in it and
 * keeps drawing in 10px sans-serif. So the family is read once from the
 * variable next/font sets on the page and handed to the painter as text.
 */
export function canvasFontFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-geist-sans').trim();
  return family ? `${family}, sans-serif` : 'sans-serif';
}
