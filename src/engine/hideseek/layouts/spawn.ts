import { Rng } from '../../core/rng';
import type { Pose } from '../frame';
import { boxSize, type HideSeekPhysics } from '../physics';
import { arenaWallRects, distanceToBox, distanceToRect } from './geometry';
import type { ArenaLayout, Region } from './types';

/** Where everything starts in one match. Agents are ordered hider, seeker. */
export interface MatchSetup {
  agents: [Pose, Pose];
  boxes: Pose[];
}

/** Gap kept between a spawning agent and any wall, box or the other agent, m. */
const CLEARANCE = 0.2;
const MAX_TRIES = 64;

/**
 * Picks spawn poses and box jitter from the match seed alone, so the same
 * seed always lays out the same room. Agents are placed by rejection
 * sampling inside their team's region until they are clear of everything.
 */
export function sampleSetup(layout: ArenaLayout, p: HideSeekPhysics, seed: number): MatchSetup {
  const rng = new Rng(seed);
  const j = p.spawn.boxJitter;
  const yj = p.spawn.boxYawJitter;
  const boxes = layout.boxes.map((s) => ({
    x: s.x + rng.range(-j, j),
    z: s.z + rng.range(-j, j),
    yaw: s.yaw + rng.range(-yj, yj),
  }));
  const walls = arenaWallRects(layout, p);
  const r = p.agent.radius;

  const isClear = (x: number, z: number, other: Pose | null): boolean => {
    for (const w of walls) if (distanceToRect(x, z, w) < r + CLEARANCE) return false;
    for (let i = 0; i < boxes.length; i++) {
      const size = boxSize(p, i);
      const b = boxes[i];
      if (distanceToBox(x, z, b.x, b.z, size.length / 2, size.width / 2, b.yaw) < r + CLEARANCE) return false;
    }
    return !other || Math.hypot(x - other.x, z - other.z) >= 2 * r + CLEARANCE;
  };

  const place = (region: Region, other: Pose | null): Pose => {
    let pose: Pose = { x: 0, z: 0, yaw: 0 };
    for (let t = 0; t < MAX_TRIES; t++) {
      pose = { x: rng.range(region.minX, region.maxX), z: rng.range(region.minZ, region.maxZ), yaw: rng.range(-Math.PI, Math.PI) };
      if (isClear(pose.x, pose.z, other)) break;
    }
    return pose;
  };

  const hider = place(layout.hiderSpawn, null);
  const seeker = place(layout.seekerSpawn, hider);
  return { agents: [hider, seeker], boxes };
}
