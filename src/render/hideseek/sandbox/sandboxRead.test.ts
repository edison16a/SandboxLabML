import { describe, expect, it } from 'vitest';
import { BOX_PLANK, BOX_RAMP, sandboxBoxAt, sandboxSnapshotLength } from '@/engine/hideseek/sandbox/snapshot';
import { FLAG_CLIMBING } from '@/engine/hideseek/snapshot';
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

  it('stops rays at the high end of a ramp, where the engine sees it, unless the viewer stands on it or above the boxes', () => {
    const buf = new Float32Array(sandboxSnapshotLength(2, 1));
    buf.set([0, 0, 0, 0, 1, 1, 1, 0]);
    // A ramp at (3, 0), lip toward +x: its slope reaches sight height 1 m up from the foot, at x = 2.8.
    buf.set([3, 0, 0, BOX_RAMP], sandboxBoxAt(2, 0));
    const boxes = new SightBoxes();
    boxes.read(buf);
    expect(sandboxSight([], boxes, 0, 0, 1, 0, 10)).toBeCloseTo(2.8, 5);
    // From beyond the lip the whole height faces the ray.
    expect(sandboxSight([], boxes, 8, 0, -1, 0, 10)).toBeCloseTo(3.8, 5);
    // A climber on it, and a viewer high enough, see past it.
    expect(sandboxSight([], boxes, 3.5, 0, 1, 0, 10, FLAG_CLIMBING, 0.8)).toBe(10);
    expect(sandboxSight([], boxes, 0, 0, 1, 0, 10, 0, 1.1)).toBe(10);
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
