import { describe, expect, it } from 'vitest';
import { BOX_KINDS } from '@/engine/hideseek/physics';
import { AGENT_ELEVATION, AGENT_X, AGENT_Z, BOX_X, BOX_Z } from '@/engine/hideseek/snapshot';
import { agentAt, blendAgentPose, boxAt, STRIDE } from '../frame/snapshotRead';
import { HS } from '../palette';
import { arenaHitColor } from './rayHits';

const RAMP = BOX_KINDS.indexOf('ramp');

/** One arena: the seeker at (5, 0), a cube at (0, 4) and the ramp at (0, -4), the other boxes far off in a corner. */
function arena(): Float32Array {
  const buf = new Float32Array(STRIDE);
  buf[agentAt(0, 1) + AGENT_X] = 5;
  BOX_KINDS.forEach((_, b) => {
    buf[boxAt(0, b) + BOX_X] = -8;
    buf[boxAt(0, b) + BOX_Z] = -8 + b * 0.01;
  });
  buf[boxAt(0, 0) + BOX_Z] = 4;
  buf[boxAt(0, 0) + BOX_X] = 0;
  buf[boxAt(0, RAMP) + BOX_X] = 0;
  buf[boxAt(0, RAMP) + BOX_Z] = -4;
  return buf;
}

/** Hue of a color, so a brightened dot still compares with the palette color it came from. */
function hue(c: { r: number; g: number; b: number }): number {
  const max = Math.max(c.r, c.g, c.b);
  return (c.r / max) * 100 + (c.g / max) * 10 + c.b / max;
}

describe('ray hit colors', () => {
  it('marks the box, the ramp and the other agent a hider ray ends on', () => {
    const snap = arena();
    expect(hue(arenaHitColor(snap, 0, 0, 0, 3.5) ?? { r: 0, g: 0, b: 1 })).toBeCloseTo(hue(HS.cube), 5);
    // The ramp's high end, where its sight slice stands, is still on its footprint.
    expect(hue(arenaHitColor(snap, 0, 0, 0.9, -3.4) ?? { r: 0, g: 0, b: 1 })).toBeCloseTo(hue(HS.ramp), 5);
    expect(hue(arenaHitColor(snap, 0, 0, 4.6, 0) ?? { r: 0, g: 0, b: 1 })).toBeCloseTo(hue(HS.seeker), 5);
    expect(arenaHitColor(snap, 0, 0, 10, 2)).toBeNull();
  });

  it('blends an agent elevation between frames, and jumps with a teleport', () => {
    const prev = arena();
    const curr = arena();
    const o = agentAt(0, 1);
    curr[o + AGENT_ELEVATION] = 1;
    const pose = { x: 0, z: 0, yaw: 0, elevation: 0 };
    expect(blendAgentPose(prev, curr, o, 0.25, pose).elevation).toBeCloseTo(0.25, 5);
    curr[o + AGENT_Z] = 6;
    expect(blendAgentPose(prev, curr, o, 0.25, pose).elevation).toBe(1);
  });
});
