import { describe, expect, it } from 'vitest';
import { BOX_PLANK, sandboxBoxAt, sandboxSnapshotLength } from '@/engine/hideseek/sandbox/snapshot';
import { sandboxSight, SightBoxes } from './sandboxRead';

/** A frame with one hider, one seeker, a cube at (3, 0) and a plank turned a quarter at (0, 5). */
function frame(): Float32Array {
  const buf = new Float32Array(sandboxSnapshotLength(2, 2));
  buf.set([0, 0, 0, 0, 1, 1, 2, 0]);
  buf.set([3, 0, 0, 0], sandboxBoxAt(2, 0));
  buf.set([0, 5, Math.PI / 2, BOX_PLANK], sandboxBoxAt(2, 1));
  return buf;
}

describe('Sandbox sight', () => {
  it('stops rays at cubes and planks by kind and yaw, and at walls', () => {
    const boxes = new SightBoxes();
    boxes.read(frame());
    // The cube is 1 m across, so its near face is half a meter before its center.
    expect(sandboxSight([], boxes, 0, 0, 1, 0, 10)).toBeCloseTo(2.5, 5);
    // The plank lies along z once turned a quarter, so its 2.4 m length faces the ray.
    expect(sandboxSight([], boxes, 0, 0, 0, 1, 10)).toBeCloseTo(3.8, 5);
    expect(sandboxSight([], boxes, 0, 0, -1, 0, 10)).toBe(10);
    expect(sandboxSight([{ x: 2, z: 0, hx: 0.1, hz: 1 }], boxes, 0, 0, 1, 0, 10)).toBeCloseTo(1.9, 5);
  });

  it('forgets boxes from an earlier frame when the next one has fewer', () => {
    const boxes = new SightBoxes();
    boxes.read(frame());
    const empty = new Float32Array(sandboxSnapshotLength(2, 0));
    empty.set([0, 0, 0, 0, 1, 1, 0, 0]);
    boxes.read(empty);
    expect(sandboxSight([], boxes, 0, 0, 1, 0, 10)).toBe(10);
  });
});
