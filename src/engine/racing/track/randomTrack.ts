import { Rng } from '../../core/rng';
import { buildTrack } from './buildTrack';
import { RING_TRACK } from './presets';
import type { Track, TrackSpec, Vec2 } from './types';
import { checkTrack } from './validate';

/**
 * Seeded random track: perturb points on a circle, then reject anything that
 * crosses itself or has a corner tighter than the car can drive. The same
 * seed always gives the same track, so random-track runs stay replayable.
 */
export function randomTrackSpec(seed: number, width = 9): TrackSpec {
  const rng = new Rng(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const count = 9 + rng.int(6);
    const base = rng.range(70, 105);
    const radii = Array.from({ length: count }, () => base * rng.range(0.55, 1.25));
    // Average neighbours once so the outline wobbles instead of spiking.
    const smooth = radii.map((r, i) => (radii[(i - 1 + count) % count] + 2 * r + radii[(i + 1) % count]) / 4);
    const points: Vec2[] = smooth.map((r, i) => {
      const a = ((i + rng.range(-0.3, 0.3)) / count) * Math.PI * 2;
      return [Math.round(r * Math.cos(a) * 10) / 10, Math.round(r * Math.sin(a) * 10) / 10];
    });
    const spec: TrackSpec = { id: `random-${seed}`, name: `Random ${seed}`, width, points };
    const track = buildTrack(spec);
    const problems = checkTrack(track);
    if (!problems.tooTight && !problems.selfIntersects && track.length > 300) return spec;
  }
  return { ...RING_TRACK, id: `random-${seed}`, name: `Random ${seed}` };
}

export function randomTrack(seed: number, width = 9): Track {
  return buildTrack(randomTrackSpec(seed, width));
}
