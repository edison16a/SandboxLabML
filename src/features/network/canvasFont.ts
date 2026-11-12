/** Which of the app's two typefaces a canvas wants. */
export type CanvasFace = 'sans' | 'mono';

const VARIABLE: Record<CanvasFace, string> = { sans: '--font-geist-sans', mono: '--font-geist-mono' };
const FALLBACK: Record<CanvasFace, string> = { sans: 'sans-serif', mono: 'ui-monospace, monospace' };

/**
 * The app's font family spelled out for a 2D canvas. A canvas does not
 * resolve CSS variables: it rejects a font string with var() in it and
 * keeps drawing in 10px sans-serif. So the family is read from the
 * variable next/font sets on the page and handed to the painter as text.
 * On the server there is no page to read, so it gives the plain fallback.
 */
export function canvasFontFamily(face: CanvasFace = 'sans'): string {
  if (typeof document === 'undefined') return FALLBACK[face];
  const family = getComputedStyle(document.documentElement).getPropertyValue(VARIABLE[face]).trim();
  return family ? `${family}, ${FALLBACK[face]}` : FALLBACK[face];
}
