import { describe, expect, it } from 'vitest';
import { BODY, WHEEL } from '../dimensions';
import { buildBody } from './assemble';
import { DLO } from './windows';
import { DETAIL, type Slot } from './parts';
import { archFloor, AXLES, beltAt } from './profile';

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
    expect(Math.abs(endAt(1, 0.55) - 2.45)).toBeLessThan(0.02);
    const lip = points(['trim']).filter(([px, , pz]) => px > 2.1 && Math.abs(pz) < 0.3);
    expect(Math.abs(Math.min(...lip.map(([, py]) => py)) - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(endAt(1, 0.88) - 2.37)).toBeLessThan(0.025);
    expect(Math.abs(topAt(2.33) - 0.9)).toBeLessThan(0.02);
  });

  it('rises along the hood to the cowl and over the roof to the lip', () => {
    expect(Math.abs(topAt(0.95) - 1.06)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-0.35) - 1.65)).toBeLessThan(0.015);
    expect(Math.abs(topAt(-1.4) - 1.5)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-0.05) - 1.6)).toBeLessThan(0.02);
    expect(Math.abs(topAt(-2.3) - 1.22)).toBeLessThan(0.025);
  });

  it('draws the tail: tailgate, bumper top and diffuser', () => {
    expect(Math.abs(endAt(-1, 0.95) + 2.42)).toBeLessThan(0.02);
    expect(Math.abs(endAt(-1, 0.85) + 2.45)).toBeLessThan(0.02);
    const tail = shell.filter(([px, , pz]) => px < -2.2 && Math.abs(pz) < 0.3);
    expect(Math.abs(Math.min(...tail.map(([, py]) => py)) - 0.32)).toBeLessThan(0.02);
  });

  it('sets the window line on the belt, kicking up at its rear point', () => {
    expect(Math.abs(beltAt(0.85)[1] - 1.08)).toBeLessThan(0.01);
    expect(Math.abs(beltAt(-1.7)[1] - 1.14)).toBeLessThan(0.01);
    expect(DLO.point).toBeCloseTo(-2.0, 2);
    expect(Math.abs(beltAt(-0.45)[0] - 0.84)).toBeLessThan(0.015);
  });

  it('stands on real ground clearance with the wheels filling their arches', () => {
    const between = shell.filter(([px]) => px > -0.9 && px < 0.95);
    expect(Math.abs(Math.min(...between.map(([, py]) => py)) - 0.21)).toBeLessThan(0.01);
    for (const axle of AXLES) {
      const gap = archFloor(axle) - 2 * WHEEL.radius;
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
