import { describe, expect, it } from 'vitest';
import { createCharacterDrive } from '../types';
import { CharacterMotion } from './characterMotion';
import { toWorld } from './vec';

const DT = 1 / 60;

/**
 * Runs an agent at `speed` m/s of simulation time, watched at `scale`x,
 * and measures how far each drawn ankle moves in the world while its foot
 * is planted: the slide a viewer would see. Returns the mean and the worst,
 * m, and the footfalls per second of wall time.
 */
function slide(speed: number, scale: number, turn = 0) {
  const m = new CharacterMotion();
  const d = createCharacterDrive();
  const held: Array<{ x: number; z: number } | null> = [null, null];
  const at = { x: 0, z: 0 };
  let sum = 0;
  let samples = 0;
  let worst = 0;
  let falls = 0;
  const frames = 360;
  for (let i = 1; i <= frames; i++) {
    // Ease up to speed over the first half second of simulation time, then hold it.
    const v = speed * Math.min(1, (i * DT * scale) / 0.5);
    d.yaw += turn * DT * scale;
    d.x += Math.cos(d.yaw) * v * DT * scale;
    d.z -= Math.sin(d.yaw) * v * DT * scale;
    const pose = m.update(d, DT, i * DT, scale);
    m.feet.forEach((f, side) => {
      const a = pose.ankles[side];
      toWorld(a.x, a.z, d.yaw, at);
      const wx = d.x + at.x;
      const wz = d.z + at.z;
      if (!f.planted) held[side] = null;
      else if (!held[side]) {
        held[side] = { x: wx, z: wz };
        falls++;
      } else if (i > 60) {
        const drift = Math.hypot(wx - held[side]!.x, wz - held[side]!.z);
        sum += drift;
        samples++;
        worst = Math.max(worst, drift);
      }
    });
  }
  return { mean: sum / Math.max(1, samples), worst, rate: falls / (frames * DT) };
}

describe('Footwork', () => {
  it('keeps a drawn foot where it was planted at every watch speed', () => {
    for (const scale of [1, 2, 4]) {
      for (const speed of [1, 3.5]) {
        const r = slide(speed, scale);
        expect(r.mean).toBeLessThan(0.012);
        expect(r.worst).toBeLessThan(0.07);
      }
      // Turning at a run too.
      expect(slide(3, scale, 1.2).mean).toBeLessThan(0.015);
    }
  });

  it('plays the stride faster at a faster watch speed instead of shortening it', () => {
    const one = slide(3, 1).rate;
    const four = slide(3, 4).rate;
    expect(four / one).toBeGreaterThan(3.3);
    expect(four / one).toBeLessThan(4.5);
  });
});
