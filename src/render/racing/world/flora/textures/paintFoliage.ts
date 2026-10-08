import { Rng } from '@/engine/core/rng';

type Ctx = CanvasRenderingContext2D;

/** Picks a color between two sRGB triples, `t` from 0 to 1, with a little jitter. */
function mix(a: readonly number[], b: readonly number[], t: number, rng: Rng, jitter = 10): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t + (rng.next() - 0.5) * jitter));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * A tuft of pine needles: fascicles of two or three long needles fanning
 * out along a few twigs, dense and dark in the middle, lighter and sparser
 * at the tips and on top, the way sun catches the outside of a pine. The
 * outline breaks into fingers so a card never reads as a disc.
 */
export function paintNeedles(g: Ctx, x0: number, y0: number, s: number, seed: number, light: number): void {
  const rng = new Rng(seed);
  const dark = [22, 36, 17];
  const lit = [96 + light * 30, 122 + light * 24, 58 + light * 6];
  g.lineCap = 'round';
  const twigs = 5 + rng.int(3);
  for (let t = 0; t < twigs; t++) {
    // Each twig starts near the middle and reaches toward the edge.
    const a = (t / twigs) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const reach = s * rng.range(0.3, 0.46);
    const bx = x0 + s / 2 + Math.cos(a) * s * 0.06;
    const by = y0 + s / 2 + Math.sin(a) * s * 0.06;
    for (let k = 0; k < 38; k++) {
      const f = k / 38;
      const px = bx + Math.cos(a) * reach * f;
      const py = by + Math.sin(a) * reach * f;
      for (let n = 0; n < 3; n++) {
        const na = a + rng.range(-1.25, 1.25) * (1 - f * 0.35);
        const len = s * rng.range(0.07, 0.13) * (1 - f * 0.3);
        const ex = px + Math.cos(na) * len;
        const ey = py + Math.sin(na) * len;
        // Lighter outward and toward the top of the tile (the sun side once mapped up).
        const up = 1 - (ey - y0) / s;
        g.strokeStyle = mix(dark, lit, Math.min(1, f * 0.7 + up * 0.45 + rng.next() * 0.2), rng);
        g.lineWidth = s * 0.0075;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(ex, ey);
        g.stroke();
      }
    }
  }
}

/**
 * A spray of broadleaf leaves: small pointed ovals on short twigs, each
 * with a darker underside half and a lit edge, overlapping thickly toward
 * the middle. Colors run from deep summer green to sunlit olive.
 */
export function paintLeaves(g: Ctx, x0: number, y0: number, s: number, seed: number, palette: { dark: number[]; lit: number[] }, size: number, count: number): void {
  const rng = new Rng(seed);
  for (let k = 0; k < count; k++) {
    // Denser in the middle: radius from a skewed random.
    const r = Math.sqrt(rng.next()) * s * 0.44;
    const a = rng.range(0, Math.PI * 2);
    const x = x0 + s / 2 + Math.cos(a) * r;
    const y = y0 + s / 2 + Math.sin(a) * r * 0.9;
    const up = 1 - (y - y0) / s;
    const out = r / (s * 0.44);
    const len = s * size * rng.range(0.7, 1.25);
    g.save();
    g.translate(x, y);
    g.rotate(a + rng.range(-0.8, 0.8));
    g.fillStyle = mix(palette.dark, palette.lit, Math.min(1, out * 0.55 + up * 0.5 + rng.next() * 0.25), rng, 16);
    g.beginPath();
    g.ellipse(0, 0, len, len * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    // The shaded half and the midrib.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    g.ellipse(0, len * 0.12, len * 0.95, len * 0.26, 0, 0, Math.PI);
    g.fill();
    g.restore();
  }
}

/** Dry twiggy brush: a tangle of thin grey brown stems with sparse small olive leaves. */
export function paintBrush(g: Ctx, x0: number, y0: number, s: number, seed: number): void {
  const rng = new Rng(seed);
  g.lineCap = 'round';
  for (let k = 0; k < 70; k++) {
    let x = x0 + s * rng.range(0.25, 0.75);
    let y = y0 + s * rng.range(0.55, 0.95);
    let a = -Math.PI / 2 + rng.range(-0.9, 0.9);
    g.strokeStyle = mix([70, 58, 44], [140, 124, 96], rng.next(), rng);
    g.lineWidth = s * rng.range(0.004, 0.009);
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      a += rng.range(-0.5, 0.5);
      x += Math.cos(a) * s * 0.08;
      y += Math.sin(a) * s * 0.08;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  paintLeaves(g, x0, y0, s, seed + 7, { dark: [58, 70, 34], lit: [150, 152, 88] }, 0.02, 160);
}

/**
 * Bark that fills the whole tile: plates separated by dark fissures that
 * run along the trunk (down the tile), for the visible lower trunks.
 */
export function paintBark(g: Ctx, x0: number, y0: number, s: number, seed: number, base: number[], fissure: number[]): void {
  const rng = new Rng(seed);
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(x0, y0, s, s);
  for (let k = 0; k < 220; k++) {
    const x = x0 + rng.next() * s;
    const y = y0 + rng.next() * s;
    const w = s * rng.range(0.03, 0.09);
    const h = s * rng.range(0.08, 0.25);
    g.fillStyle = mix(base.map((v) => v * 0.8), base.map((v) => Math.min(255, v * 1.25)), rng.next(), rng, 14);
    g.fillRect(x, y, w, h);
  }
  g.strokeStyle = `rgb(${fissure.join(',')})`;
  for (let k = 0; k < 26; k++) {
    let x = x0 + rng.next() * s;
    g.lineWidth = s * rng.range(0.006, 0.016);
    g.beginPath();
    g.moveTo(x, y0);
    for (let y = y0; y <= y0 + s; y += s / 8) {
      x += rng.range(-0.025, 0.025) * s;
      g.lineTo(x, y);
    }
    g.stroke();
  }
}
