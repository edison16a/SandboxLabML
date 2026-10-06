/**
 * CSS color for a ghost, `t` running from 0 for the oldest to 1 for the
 * newest. Matches palette.ghostColor in the 3D scene: slate for early
 * generations, accent blue for recent ones, so a line or a dot in the UI
 * reads as the same car on screen.
 */
export function ghostCss(t: number): string {
  const a = [127, 143, 176];
  const b = [76, 154, 255];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c.join(',')})`;
}
