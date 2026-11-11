import { describe, expect, it } from 'vitest';
import { RAY_MOVER, RAY_NONE, RAY_SOLID, RAY_SPIKES } from '@/engine/navigation/agent';
import { StreamedInputs } from './streamedInputs';

/** Four rays with hit types, then the finish bearing: distances, spikes flags, mover flags, bearing. */
function obs(distances: number[], spikes: number[], movers: number[], bearing: number): Float32Array {
  return Float32Array.from([...distances, ...spikes, ...movers, bearing, 0.5]);
}

describe('streamed inputs for the sensor overlay', () => {
  it('reads each ray as the brain did, with what it met', () => {
    const s = new StreamedInputs();
    expect(s.take({ index: 2, obs: obs([0.5, 1, 0.25, 0.75], [1, 0, 0, 0], [0, 0, 1, 0], 0.1) }, 2, 14)).toBe(true);
    const hit = { distance: 0, kind: 0 };
    s.ray(0, 4, 10, true, 1, hit);
    expect(hit).toEqual({ distance: 5, kind: RAY_SPIKES });
    s.ray(1, 4, 10, true, 1, hit);
    expect(hit).toEqual({ distance: 10, kind: RAY_NONE });
    s.ray(2, 4, 10, true, 1, hit);
    expect(hit.kind).toBe(RAY_MOVER);
    s.ray(3, 4, 10, true, 1, hit);
    expect(hit).toEqual({ distance: 7.5, kind: RAY_SOLID });
    expect(s.value(12, 1)).toBeCloseTo(0.1);
  });

  it('blends from the frame before to the latest for the same runner only', () => {
    const s = new StreamedInputs();
    s.take({ index: 1, obs: obs([0.2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], 0) }, 1, 14);
    s.take({ index: 1, obs: obs([0.6, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], 0) }, 1, 14);
    expect(s.value(0, 0.5)).toBeCloseTo(0.4);
    // A new runner starts from its own latest values, without blending from the old one.
    s.take({ index: 4, obs: obs([0.9, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], 0) }, 4, 14);
    expect(s.value(0, 0.5)).toBeCloseTo(0.9);
  });

  it('refuses inputs of another runner or too short for the config', () => {
    const s = new StreamedInputs();
    expect(s.take({ index: 0, obs: new Float32Array(14) }, 3, 14)).toBe(false);
    expect(s.take({ index: 3, obs: new Float32Array(5) }, 3, 14)).toBe(false);
    expect(s.take(null, 3, 14)).toBe(false);
  });
});
