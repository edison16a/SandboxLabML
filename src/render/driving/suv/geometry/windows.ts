import type * as THREE from 'three';
import { smooth } from './curve';
import { CABIN, cabinBand, cabinStations, onCabin } from './cabin';
import { bothSides, gridGeometry, type Vec3 } from './grid';
import type { Detail, PartBin } from './parts';

/**
 * The window graphic: one dark shape along the cabin side from the A
 * pillar back to a point over the rear wheel, its lower edge kicking up
 * under the rear quarter window. Inside it the pillars are gloss black,
 * so the glass reads as one band and the painted roof seems to float.
 */
export const DLO = { front: CABIN.front, kick: -0.95, drop: -1.18, point: -1.88 };
/** Pillar and divider spans along the car, m. */
const B_PILLAR = { from: -0.29, to: -0.18 };
const DIVIDER = { from: -0.96, to: -0.92 };
/** The bright surround's width and the glass's margin inside the graphic, m. */
const SURROUND = 0.012;
const MARGIN = 0.017;

/** Length of the cabin's side band at x, belt to rail, m. */
function sideHeight(x: number): number {
  const pts = cabinBand(x, 0, 16);
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return Math.max(d, 1e-4);
}

/** Height of the graphic's lower edge above the belt, m: level along the doors, kicking up under the quarter window. */
function lowM(x: number): number {
  return 0.11 * smooth((DLO.kick - x) / (DLO.kick - DLO.point)) ** 1.2;
}

/** The graphic's edges at x as shares of the side band: its lower edge and its upper edge, which meet at the rear point. */
export function dloAt(x: number): [number, number] {
  const h = sideHeight(x);
  const low = lowM(x) / h;
  const meet = lowM(DLO.point) / sideHeight(DLO.point);
  const k = smooth((DLO.drop - x) / (DLO.drop - DLO.point));
  return [low, 1 - (1 - meet) * k ** 1.15];
}

/** A strip on the side band from x0 to x1 between shares t0(x) and t1(x), lifted off the base. */
function sideStrip(x0: number, x1: number, t0: (x: number) => number, t1: (x: number) => number, lift: number, detail: Detail, across = 2): THREE.BufferGeometry {
  const rows: Vec3[][] = cabinStations(x0, x1, detail).map((x) => {
    const a = t0(x);
    const b = t1(x);
    return Array.from({ length: across + 1 }, (_, j) => onCabin(x, 0, a + ((b - a) * j) / across, lift));
  });
  return bothSides(gridGeometry(rows));
}

const at = (v: number) => () => v;

/**
 * The cabin's side band. Inside the graphic it is gloss black with three
 * windows laid on it. Above the graphic and behind its rear point the
 * band stays gloss black up to the roof edge, a dark fin that sweeps
 * down toward the deck and meets the black beside the rear glass, so
 * only the painted roof panel reads, floating. Under the kick and the
 * fin it is paint, flowing into the haunch.
 */
export function addWindows(bin: PartBin, detail: Detail): void {
  const n = detail.cabin[0];
  const low = (x: number) => dloAt(x)[0];
  const high = (x: number) => dloAt(x)[1];
  // The fin's lower edge: from the graphic's rear point down to the belt where the cabin meets the deck.
  const meet = low(DLO.point);
  const fin = (x: number) => meet * smooth((x - CABIN.rear) / (DLO.point - CABIN.rear)) ** 0.8;
  bin.add('paint', sideStrip(CABIN.rear, DLO.point, at(0), fin, 0, detail, Math.max(1, n - 3)));
  bin.add('trim', sideStrip(CABIN.rear, DLO.point, fin, at(1), 0, detail, n));
  bin.add('trim', sideStrip(DLO.point, DLO.front, low, high, 0, detail, n));
  bin.add('paint', sideStrip(DLO.point, DLO.kick, at(0), low, 0, detail, 1));
  bin.add('trim', sideStrip(DLO.point, DLO.drop, high, at(1), 0, detail, Math.max(1, n - 2)));
  // The glass, a little proud of the black, inside a margin that leaves room for the surround.
  const m = (x: number) => MARGIN / sideHeight(x);
  const inLow = (x: number) => low(x) + m(x);
  const inHigh = (x: number) => Math.max(inLow(x), high(x) - m(x));
  const glassEnd = DLO.front - 0.06;
  bin.add('glass', sideStrip(B_PILLAR.to, glassEnd, inLow, inHigh, 0.003, detail, n));
  bin.add('glass', sideStrip(DIVIDER.to, B_PILLAR.from, inLow, inHigh, 0.003, detail, n));
  bin.add('glass', sideStrip(DLO.point + 0.05, DIVIDER.from, inLow, inHigh, 0.003, detail, n));
  // The bright surround traces the graphic's top and bottom and meets at the rear point.
  const s = (x: number) => SURROUND / sideHeight(x);
  bin.add('metal', sideStrip(DLO.point, DLO.front - 0.01, (x) => Math.max(low(x), high(x) - s(x)), high, 0.002, detail, 1));
  bin.add('metal', sideStrip(DLO.point, DLO.front - 0.01, low, (x) => Math.min(high(x), low(x) + s(x)), 0.002, detail, 1));
}

/** A panoramic glass roof set into the paint in a slim black frame, the view the chase camera sees most. */
export function addSunroof(bin: PartBin, detail: Detail): void {
  const rows = (x0: number, x1: number, t0: number, lift: number): Vec3[][] =>
    cabinStations(x0, x1, detail).map((x) => Array.from({ length: 5 }, (_, j) => onCabin(x, 2, t0 + ((1 - t0) * j) / 4, lift)));
  bin.add('trim', bothSides(gridGeometry(rows(-0.88, 0.05, 0.27, 0.002))));
  bin.add('glass', bothSides(gridGeometry(rows(-0.86, 0.03, 0.3, 0.004))));
}
