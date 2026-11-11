import { cabinBand } from './cabin';
import { smooth } from './curve';
import { gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';
import { TAIL } from './profile';
import { warp } from './warp';

/**
 * The lip spoiler where the roofline ends, before the bend, m. Its root
 * lies on the painted deck behind the rear glass and its top rises out
 * of the roof's own line to a crisp trailing edge at the tail. The edge
 * runs on one gentle arch, `top` at the middle falling `crown` to the
 * ends, about 3 cm above where the deck would run on, so the roofline
 * turns up at its end. `half` is how far it reaches: the whole tail.
 */
export const LIP = { root: -2.2, edge: TAIL - 0.002, top: 1.226, crown: 0.03, half: 0.645, edgeDepth: 0.007 };

/** The deck's top at (x, z) behind the rear glass: the cabin's section there from belt to centerline, read at z. */
export function deckAt(x: number, z: number): number {
  const pts = [...cabinBand(x, 0, 6), ...cabinBand(x, 1, 3).slice(1), ...cabinBand(x, 2, 24).slice(1)];
  const a = Math.abs(z);
  for (let i = 0; i < pts.length - 1; i++) {
    const [z0, y0] = pts[i];
    const [z1, y1] = pts[i + 1];
    if (a <= z0 && a >= z1) return y0 + ((y1 - y0) * (a - z0)) / (z1 - z0 || 1);
  }
  return a > pts[0][0] ? pts[0][1] : pts[pts.length - 1][1];
}

/** The trailing edge's height at z: the arch, easing down onto the deck over the last 12 cm, where it dives in. */
function edgeAt(z: number, deck: number): number {
  const arch = LIP.top - LIP.crown * (z / LIP.half) ** 2;
  return deck + (arch - deck) * smooth((LIP.half - Math.abs(z)) / 0.12);
}

/**
 * The lip spoiler: full width across the top of the tail, body colored.
 * Each column runs from the root on the deck, up the lip's top to its
 * crisp trailing edge, down that edge and back under it into the roll
 * at the top of the tail face, which leaves a shadow line beneath it.
 */
export function addSpoiler(bin: PartBin, detail: Detail): void {
  const n = detail.fine ? 40 : detail.brakes ? 16 : 8;
  const up = detail.fine ? 5 : detail.brakes ? 3 : 1;
  // Where the deck would run on, just before it rolls down into the tail face.
  const on = LIP.edge + 0.027;
  const rows: Vec3[][] = [];
  for (let i = 0; i <= n; i++) {
    // Columns bunch up toward the ends, where the lip dives into the deck over a short run.
    const z = -LIP.half * Math.cos((Math.PI * i) / n);
    const line = deckAt(on, z);
    const rootY = deckAt(LIP.root, z);
    const edgeY = edgeAt(z, line) - 0.0008;
    // How much of the lip stands at this column, 0 where it has dived into the deck.
    const k = (edgeY - line) / (LIP.top - deckAt(on, 0));
    const col: Vec3[] = [];
    // The top: a quadratic from the root, held to the deck's line, up to the edge.
    for (let j = 0; j <= up; j++) {
      const t = j / up;
      const x = (1 - t) * (1 - t) * LIP.root + 2 * (1 - t) * t * on + t * t * LIP.edge;
      col.push([x, (1 - t) * (1 - t) * rootY + 2 * (1 - t) * t * line + t * t * edgeY, z]);
    }
    const depth = LIP.edgeDepth * Math.max(0, Math.min(1, k));
    col.push([LIP.edge - 0.0006, edgeY - depth, z]);
    col.push([on - 0.012, line + 0.3 * (edgeY - line) - depth, z]);
    col.push([on - 0.006, deckAt(on - 0.006, z) - 0.002, z]);
    rows.push(col.map(warp));
  }
  // Rows walk across z and each runs from the root back over the edge: walked from +z down, that faces up and out.
  bin.add('paint', gridGeometry(rows.reverse()));
}
