import { describe, expect, it } from 'vitest';
import { offsetX, offsetZ, type Pose } from '../frame';
import { arenaWallRects, distanceToBox, distanceToRect } from '../layouts/geometry';
import { HIDESEEK_LAYOUT_IDS, HIDESEEK_LAYOUTS } from '../layouts/presets';
import { sampleSetup } from '../layouts/spawn';
import { BOX_COUNT, BOX_KINDS, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '../physics';

const P = DEFAULT_HIDESEEK_PHYSICS;

/** Points every 0.1 m around the footprint of box `index` at `pose`. */
function outline(index: number, pose: Pose): Array<[number, number]> {
  const s = boxSize(P, index);
  const out: Array<[number, number]> = [];
  for (let u = -s.length / 2; u <= s.length / 2 + 1e-9; u += 0.1) {
    for (const v of [-s.width / 2, s.width / 2]) out.push([pose.x + offsetX(u, v, pose.yaw), pose.z + offsetZ(u, v, pose.yaw)]);
  }
  for (let v = -s.width / 2; v <= s.width / 2 + 1e-9; v += 0.1) {
    for (const u of [-s.length / 2, s.length / 2]) out.push([pose.x + offsetX(u, v, pose.yaw), pose.z + offsetZ(u, v, pose.yaw)]);
  }
  return out;
}

describe('built-in rooms', () => {
  it('have five box spots in BOX_KINDS order, the ramp last', () => {
    expect(BOX_KINDS).toEqual(['cube', 'cube', 'plank', 'plank', 'ramp']);
    for (const id of HIDESEEK_LAYOUT_IDS) expect(HIDESEEK_LAYOUTS[id].boxes).toHaveLength(BOX_COUNT);
  });

  it('start every box clear of the walls and of each other, whatever the jitter', () => {
    for (const id of HIDESEEK_LAYOUT_IDS) {
      const layout = HIDESEEK_LAYOUTS[id];
      const walls = arenaWallRects(layout, P);
      for (let seed = 1; seed <= 200; seed++) {
        const { boxes } = sampleSetup(layout, P, seed);
        boxes.forEach((pose, i) => {
          for (const [x, z] of outline(i, pose)) {
            for (const w of walls) expect(distanceToRect(x, z, w), `${id} box ${i} seed ${seed}`).toBeGreaterThan(0.2);
            boxes.forEach((other, j) => {
              if (j === i) return;
              const s = boxSize(P, j);
              expect(distanceToBox(x, z, other.x, other.z, s.length / 2, s.width / 2, other.yaw), `${id} boxes ${i} and ${j}`).toBeGreaterThan(0);
            });
          }
        });
      }
    }
  });
});
