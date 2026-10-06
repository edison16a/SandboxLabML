import type { SnapshotLayout } from '../env/types';
import { offsetX, offsetZ } from './frame';
import type { MatchState } from './match/state';
import type { SensorRays } from './sensing/rays';

/** Rays per agent in the optional rays stream. */
export const SNAPSHOT_RAYS = 16;

/**
 * The optional rays stream: 16 ray hit points (x, z) per agent, hider
 * first, 64 floats per arena. Brains with more rays are thinned evenly
 * (ray 0, straight ahead, is always kept). Brains with fewer fill the
 * spare slots with the agent's own position, which draws as nothing. A
 * blind seeker's rays reach their full range.
 */
export const HIDESEEK_RAY_SNAPSHOT: SnapshotLayout = {
  stride: 2 * SNAPSHOT_RAYS * 2,
  fields: ['hider', 'seeker'].flatMap((team) => Array.from({ length: SNAPSHOT_RAYS }, (_, k) => [`${team}.ray${k}.x`, `${team}.ray${k}.z`]).flat()),
};

export function writeRaySnapshot(s: MatchState, rays: SensorRays[], out: Float32Array, offset = 0): void {
  for (let i = 0; i < 2; i++) {
    const a = s.agents[i];
    const r = rays[i];
    const base = offset + i * SNAPSHOT_RAYS * 2;
    for (let k = 0; k < SNAPSHOT_RAYS; k++) {
      let x = a.x;
      let z = a.z;
      if (k < r.count || r.count > SNAPSHOT_RAYS) {
        const j = r.count > SNAPSHOT_RAYS ? Math.floor((k * r.count) / SNAPSHOT_RAYS) : k;
        const d = a.rays[j];
        const yaw = a.yaw + r.angles[j];
        x += offsetX(d, 0, yaw);
        z += offsetZ(d, 0, yaw);
      }
      out[base + 2 * k] = x;
      out[base + 2 * k + 1] = z;
    }
  }
}
