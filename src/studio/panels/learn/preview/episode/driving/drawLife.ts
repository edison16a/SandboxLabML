import type { DrivingPreviewScene } from '@/engine/driving/preview/scene';
import { DRIVING_WORLD, WORLD_CARS, WORLD_PEDS, WORLD_SIGNALS } from '@/engine/driving/snapshot';
import { LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW } from '@/engine/driving/signals/plan';
import { FLAG_BRAKE } from '@/engine/driving/world/state';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { lerp, lerpAngle } from '../../playback';
import { px, py, type View } from '../../view';

/** The moving city: signal lamps in their real colors, other cars in grey with brake lights, people in white. */
const LIFE = {
  red: '#ff5f5f',
  yellow: '#f5c451',
  green: '#3dd68c',
  off: 'rgba(245, 196, 81, 0.5)',
  car: '#7d879a',
  carRoof: '#9aa3b5',
  brake: '#ff5f5f',
  person: '#e7ebf3',
};

/** Smallest a lamp, a car and a person are drawn, px, so they stay visible on a city map in a small preview. */
const MIN_LAMP_PX = 2.2;
const MIN_PERSON_PX = 1.6;

/** Lamp color for a light state, or null where the approach has no street or the signals are off. */
function lampColor(state: number, on: boolean): string | null {
  if (state < 0 || !on) return null;
  return state === LIGHT_RED ? LIFE.red : state === LIGHT_YELLOW ? LIFE.yellow : state === LIGHT_GREEN ? LIFE.green : LIFE.off;
}

/** Every signal's lamp at its stop line, colored by what it shows at tick i. */
function drawLamps(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene, w: Float32Array, o: number): void {
  const on = w[o + 4] > 0.5;
  const r = Math.max(MIN_LAMP_PX, 0.7 * v.scale);
  for (let k = 0; k < s.lamps.length; k += 4) {
    const color = lampColor(w[o + WORLD_SIGNALS + s.lamps[k] * DRIVING_WORLD.signalStride + s.lamps[k + 1]], on);
    if (!color) continue;
    g.fillStyle = color;
    g.beginPath();
    g.arc(px(v, s.lamps[k + 2]), py(v, s.lamps[k + 3]), r, 0, 2 * Math.PI);
    g.fill();
  }
}

/** One value of slot `k` of a world block between ticks i and j, without smearing a car that respawned elsewhere. */
function between(w: Float32Array, a: number, b: number, f: number): number {
  return Math.abs(w[b] - w[a]) > 6 ? w[a] : lerp(w[a], w[b], f);
}

/** Other cars as rounded boxes with a lighter roof, and a red rear edge while they brake. */
function drawCars(g: CanvasRenderingContext2D, v: View, w: Float32Array, a: number, b: number, f: number): void {
  const count = Math.min(w[a + 2], w[b + 2]);
  for (let i = 0; i < count; i++) {
    const oa = a + WORLD_CARS + i * DRIVING_WORLD.carStride;
    const ob = b + WORLD_CARS + i * DRIVING_WORLD.carStride;
    const x = between(w, oa, ob, f);
    const y = between(w, oa + 1, ob + 1, f);
    const heading = lerpAngle(w[oa + 2], w[ob + 2], f);
    const length = w[oa + 6] * v.scale;
    const width = w[oa + 7] * v.scale;
    g.save();
    g.translate(px(v, x), py(v, y));
    g.rotate(-heading);
    g.fillStyle = LIFE.car;
    g.beginPath();
    g.roundRect(-length / 2, -width / 2, length, width, Math.min(2, width / 3));
    g.fill();
    g.fillStyle = LIFE.carRoof;
    g.fillRect(-length * 0.22, -width * 0.32, length * 0.38, width * 0.64);
    if ((w[oa + 5] & FLAG_BRAKE) !== 0) {
      g.fillStyle = LIFE.brake;
      g.fillRect(-length / 2, -width / 2, Math.max(1, 0.25 * v.scale), width);
    }
    g.restore();
  }
}

function drawPeople(g: CanvasRenderingContext2D, v: View, w: Float32Array, a: number, b: number, f: number): void {
  const count = Math.min(w[a + 3], w[b + 3]);
  const r = Math.max(MIN_PERSON_PX, 0.35 * v.scale);
  g.fillStyle = LIFE.person;
  for (let i = 0; i < count; i++) {
    const oa = a + WORLD_PEDS + i * DRIVING_WORLD.pedStride;
    const ob = b + WORLD_PEDS + i * DRIVING_WORLD.pedStride;
    g.beginPath();
    g.arc(px(v, between(w, oa, ob, f)), py(v, between(w, oa + 1, ob + 1, f)), r, 0, 2 * Math.PI);
    g.fill();
  }
}

/** The city's moving parts at the playhead, between recorded ticks i and j. Draws nothing when the recording kept no world. */
export function drawLife(g: CanvasRenderingContext2D, v: View, s: DrivingPreviewScene, p: EpisodePreview, i: number, j: number, f: number): void {
  if (p.worldFloats === 0) return;
  const a = i * p.worldFloats;
  const b = j * p.worldFloats;
  drawLamps(g, v, s, p.world, a);
  drawCars(g, v, p.world, a, b, f);
  drawPeople(g, v, p.world, a, b, f);
}
