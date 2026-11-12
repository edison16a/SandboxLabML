import { describe, expect, it } from 'vitest';
import { BODY, WHEEL } from '../dimensions';
import { buildBody } from './assemble';
import { DLO } from './windows';
import { DETAIL, type Slot } from './parts';
import { CABIN } from './cabin';
import { AXLES, beltAt } from './profile';
import { deckAt, LIP } from './spoiler';

/**
 * The SUV's design hardpoints, probed from the built High detail body:
 * the side silhouette on the centerline, the window line, the clearance
 * and the plan widths. Each should land within about 2 cm of the drawing.
 */
const body = buildBody(DETAIL.high);

/** Every vertex of the given slots, as flat [x, y, z] triples. */
function points(slots: Slot[]): number[][] {
  const out: number[][] = [];
  for (const slot of slots) {
    const p = body.get(slot)?.attributes.position;
    if (p) for (let i = 0; i < p.count; i++) out.push([p.getX(i), p.getY(i), p.getZ(i)]);
  }
  return out;
}

const shell = points(['paint', 'trim', 'glass']);
const near = (a: number, b: number, d: number) => Math.abs(a - b) <= d;
/** Highest point of the shell on the centerline around x. */
const topAt = (x: number) => Math.max(...shell.filter(([px, , pz]) => near(px, x, 0.03) && Math.abs(pz) < 0.03).map(([, py]) => py));
/**
 * How far forward (end 1) or back (end -1) the centerline reaches at
 * height y: the outermost centerline vertex at each height, joined into
 * a polyline and read between its points, as the mesh draws it.
 */
function endAt(end: 1 | -1, y: number): number {
  const reach = new Map<number, number>();
  for (const [px, py, pz] of shell) {
    if (Math.abs(pz) > 0.003 || end * px < 2.0) continue;
    const k = Math.round(py * 1e4);
    reach.set(k, Math.max(reach.get(k) ?? -Infinity, end * px));
  }
  const line = [...reach].map(([k, r]) => [k / 1e4, r]).sort((a, b) => a[0] - b[0]);
  const i = line.findIndex(([py]) => py >= y);
  const [y0, r0] = line[Math.max(0, i - 1)];
  const [y1, r1] = line[i];
  return end * (r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1));
}
/** Half width of the painted body around x, below the glass. */
const halfWidth = (x: number) => Math.max(...points(['paint']).filter(([px, py]) => near(px, x, 0.02) && py < 1.1).map(([, , pz]) => pz));

describe('SUV silhouette', () => {
  it('draws the nose: lip, fold and hood edge', () => {
    expect(Math.abs(endAt(1, 0.6) - 2.45)).toBeLessThan(0.02);
    const lip = points(['trim']).filter(([px, , pz]) => px > 2.1 && Math.abs(pz) < 0.3);
    expect(Math.abs(Math.min(...lip.map(([, py]) => py)) - 0.3)).toBeLessThan(0.02);
    // The hood's leading edge, where the face turns into the hood: x 2.34 at y 0.97.
    expect(Math.abs(endAt(1, 0.97) - 2.34)).toBeLessThan(0.02);
    expect(Math.abs(topAt(2.34) - 0.97)).toBeLessThan(0.02);
  });

  it('rises along the hood to the cowl and over the roof to the lip', () => {
    expect(Math.abs(topAt(0.95) - 1.12)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-0.1) - 1.66)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-0.45) - 1.68)).toBeLessThan(0.015);
    // A coupe roof that falls late: within 2 cm of the peak over the rear seats.
    for (const x of [-0.7, -1.0]) expect(topAt(x)).toBeGreaterThan(1.66);
    expect(Math.abs(topAt(-1.3) - 1.62)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-1.85) - 1.52)).toBeLessThan(0.02);
  });

  it('ends the roofline in a lip spoiler at x -2.30, y 1.33, standing about 3 cm above the deck', () => {
    // The rearmost paint above the tail face's top: the lip's trailing edge.
    const lip = points(['paint']).filter(([px, py, pz]) => px < -2.2 && py > 1.27 && Math.abs(pz) < 0.02);
    const back = Math.min(...lip.map(([px]) => px));
    // The top of the crisp edge there, which draws the silhouette.
    const edge = lip.filter(([px]) => px < back + 0.006).reduce((m, p) => (p[1] > m[1] ? p : m));
    expect(Math.abs(edge[0] + 2.3)).toBeLessThan(0.02);
    expect(Math.abs(edge[1] - 1.33)).toBeLessThan(0.02);
    const standOut = edge[1] - deckAt(LIP.edge + 0.027, 0);
    expect(standOut).toBeGreaterThan(0.02);
    expect(standOut).toBeLessThan(0.04);
  });

  it('draws the tail: tailgate, light bar, bumper top and diffuser', () => {
    expect(Math.abs(endAt(-1, 1.085) + 2.42)).toBeLessThan(0.02);
    expect(Math.abs(endAt(-1, 0.92) + 2.45)).toBeLessThan(0.02);
    const tail = shell.filter(([px, , pz]) => px < -2.2 && Math.abs(pz) < 0.3);
    expect(Math.abs(Math.min(...tail.map(([, py]) => py)) - 0.34)).toBeLessThan(0.02);
  });

  it('sets the window line on the belt, kicking up at its rear point', () => {
    // The gloss black window graphic's lower edge, as built.
    const graphicFoot = (x: number) => Math.min(...points(['trim']).filter(([px, py, pz]) => near(px, x, 0.02) && py > 1.02 && pz > 0.6).map(([, py]) => py));
    expect(Math.abs(graphicFoot(0.85) - 1.13)).toBeLessThan(0.015);
    expect(Math.abs(graphicFoot(-1.7) - 1.18)).toBeLessThan(0.015);
    expect(Math.abs(graphicFoot(-2.0) - 1.25)).toBeLessThan(0.025);
    expect(DLO.point).toBeCloseTo(-2.0, 2);
    expect(Math.abs(beltAt(-0.45)[0] - 0.84)).toBeLessThan(0.015);
    // About 0.46 m of glass at the B pillar, between the bright surround's two strips, its top about 6 cm under the roofline.
    const surround = points(['metal']).filter(([px, py, pz]) => near(px, -0.45, 0.02) && py > 1 && pz > 0.6).map(([, py]) => py);
    expect(Math.abs(Math.max(...surround) - Math.min(...surround) - 0.46)).toBeLessThan(0.03);
    expect(Math.abs(topAt(-0.45) - Math.max(...surround) - 0.06)).toBeLessThan(0.02);
  });

  it('ends the C pillar fin on the rear glass line', () => {
    const fin = points(['trim']).filter(([px, py, pz]) => py > 1.12 && pz > 0.5 && px < -1.9);
    expect(Math.min(...fin.map(([px]) => px))).toBeGreaterThan(CABIN.glassRear - 0.03);
  });

  it('stands on real ground clearance with the wheels filling their arches', () => {
    const between = points(['paint', 'trim', 'glass', 'clad']).filter(([px]) => px > -0.9 && px < 0.95);
    expect(Math.abs(Math.min(...between.map(([, py]) => py)) - 0.22)).toBeLessThan(0.01);
    for (const axle of AXLES) {
      // The arch's painted edge over the wheel's top, as built.
      const edge = Math.min(...points(['paint']).filter(([px, py, pz]) => near(px, axle, 0.01) && pz > 0.8 && py > 0.6 && py < 0.95).map(([, py]) => py));
      const gap = edge - 2 * WHEEL.radius;
      expect(gap).toBeGreaterThan(0.04);
      expect(gap).toBeLessThan(0.06);
    }
  });

  it('tucks each tire 1 to 2 cm inside the body side', () => {
    const outer = (track: number) => track + WHEEL.width / 2 + 0.008;
    for (const [x, track] of [[BODY.axleFront, BODY.trackFront], [BODY.axleRear, BODY.trackRear]]) {
      const inset = halfWidth(x) - outer(track);
      expect(inset).toBeGreaterThan(0.01);
      expect(inset).toBeLessThan(0.02);
    }
  });

  it('is widest over the rear haunch and pulled in at the doors', () => {
    expect(Math.abs(halfWidth(1.48) - 0.965)).toBeLessThan(0.012);
    expect(Math.abs(halfWidth(0) - 0.945)).toBeLessThan(0.012);
    expect(Math.abs(halfWidth(-1.42) - 1.0)).toBeLessThan(0.012);
  });
});
