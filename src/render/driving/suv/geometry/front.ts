import { smooth } from './curve';
import { addIntakes, addLip } from './intakes';
import { capDisc, capPanel, capSpan, at } from './panels';
import type { Detail, PartBin } from './parts';
import type { Pt } from './section';

/**
 * The headlight in the face's unrolled coordinates (s runs across the
 * face and on round the corner): 0.34 m on the face and 0.12 m wrapped
 * round onto the fender, right under the fender peak.
 */
export const LAMP = { inner: 0.4, outer: 0.86, round: 0.026 };

/** The lens's top edge at s: level across the face, rising round the corner to tuck just under the shoulder crease, which runs on from it. */
const lampTop = (s: number) => 0.878 + 0.05 * smooth((s - 0.58) / 0.22);

/** The lens's height at s: 8 cm at the inner end, 11 cm at the outer end. */
const lampHeight = (s: number) => 0.08 + (0.03 * (s - LAMP.inner)) / (LAMP.outer - LAMP.inner);

/** How far a rounded end pulls both edges in, `e` m from the end. */
function endPull(e: number, r: number): number {
  if (e >= r) return 0;
  const d = r - Math.max(e, 0);
  return r - Math.sqrt(Math.max(0, r * r - d * d));
}

/**
 * The headlight lens at u (0 at its inner end, 1 at the outer end), its
 * lower and upper edge as (s, y), grown by `grow` m all round. The ends
 * are rounded, so the lamp reads as one shaped unit.
 */
export function headlampLens(u: number, grow = 0): { lo: Pt; hi: Pt } {
  const s = LAMP.inner - grow + (LAMP.outer - LAMP.inner + 2 * grow) * u;
  const r = LAMP.round + grow;
  const pull = endPull(Math.min(s - (LAMP.inner - grow), LAMP.outer + grow - s), r);
  const top = lampTop(s) + grow;
  const bottom = lampTop(s) - lampHeight(s) - grow;
  return { lo: [s, bottom + pull], hi: [s, top - pull] };
}

/** Column shares along the lamp, packed toward both ends so the rounded ends stay round. */
const spread = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/**
 * The headlights: a tight gloss black bezel round a dark lens, a slim
 * light strip along its top edge, a projector inboard and the four point
 * light signature in a square, the mark you recognize in a mirror.
 */
function addHeadlights(bin: PartBin, detail: Detail): void {
  const c = detail.fine ? 30 : detail.brakes ? 14 : 6;
  const lens = (grow: number, side: 'lo' | 'hi') => (u: number) => headlampLens(spread(u), grow)[side];
  if (detail.brakes) bin.add('trim', capSpan(1, lens(0.007, 'lo'), lens(0.007, 'hi'), 0.004, c, 2));
  bin.add('glass', capSpan(1, lens(0, 'lo'), lens(0, 'hi'), 0.007, c, 2));
  // The light strip: a slim line just under the lens's top edge, most of its length.
  const strip = (down: number) => (u: number) => {
    const s = 0.43 + 0.405 * u;
    return [s, lampTop(s) - down] as Pt;
  };
  bin.add('led', capSpan(1, strip(0.016), strip(0.008), 0.0095, c, 1));
  if (!detail.fine && !detail.brakes) return;
  const seg = detail.fine ? 20 : 10;
  // A projector inboard: a chrome ring with a dark lens in it.
  const py = lampTop(0.5) - lampHeight(0.5) * 0.58;
  bin.add('metal', capDisc(1, 0.5, py, 0.021, 0.0085, seg));
  bin.add('glass', capDisc(1, 0.5, py, 0.014, 0.0095, seg));
  // Four points in a square on a dark ground, toward the corner.
  const qs = 0.665;
  const qy = lampTop(qs) - lampHeight(qs) * 0.56;
  bin.add('trim', capPanel(1, at(qs - 0.034), at(qs + 0.034), qy - 0.03, qy + 0.03, 0.0085, 3, 2));
  for (const ds of [-0.017, 0.017]) for (const dy of [-0.0145, 0.0145]) bin.add('led', capDisc(1, qs + ds, qy + dy, 0.0095, 0.0105, seg));
}

/** The whole nose: lamps on top, intakes below, the splitter under them, all laid on the bent face. */
export function addFront(bin: PartBin, detail: Detail): void {
  addHeadlights(bin, detail);
  addIntakes(bin, detail);
  addLip(bin, detail);
}
