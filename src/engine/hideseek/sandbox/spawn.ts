import { Rng } from '../../core/rng';
import type { Pose } from '../frame';
import { distanceToBox, distanceToRect } from '../layouts/geometry';
import type { Region } from '../layouts/types';
import { boxKindSize, type HideSeekPhysics } from '../physics';
import type { BoxSpawn } from '../world/build';
import { roomWallRects, type SandboxRoom } from './room';

/** Where everything starts: agents in slot order (hiders, then seekers), then the boxes. */
export interface SandboxSetup {
  agents: Pose[];
  boxes: BoxSpawn[];
}

/** Gap kept between a spawning agent and any wall, box or other agent, m. */
const CLEARANCE = 0.2;
const TRIES = 64;

/**
 * Picks every player's start pose from the seed alone, so the same seed
 * always lays out the same match. Boxes start exactly where the user put
 * them. Each player is placed by rejection sampling in its team's spawn
 * area; when the area is too crowded it tries the whole room, and as a
 * last resort it keeps the final try and lets the physics push it clear.
 */
export function sandboxSetup(room: SandboxRoom, p: HideSeekPhysics, seed: number, hiders: number, seekers: number): SandboxSetup {
  const rng = new Rng(seed);
  const boxes: BoxSpawn[] = room.boxes.map((b) => ({ pose: { x: b.x, z: b.z, yaw: b.yaw }, kind: b.kind }));
  const walls = roomWallRects(room, p);
  const r = p.agent.radius;
  const agents: Pose[] = [];

  const isClear = (x: number, z: number): boolean => {
    for (const w of walls) if (distanceToRect(x, z, w) < r + CLEARANCE) return false;
    for (const b of boxes) {
      const size = boxKindSize(p, b.kind);
      if (distanceToBox(x, z, b.pose.x, b.pose.z, size.length / 2, size.width / 2, b.pose.yaw) < r + CLEARANCE) return false;
    }
    for (const a of agents) if (Math.hypot(x - a.x, z - a.z) < 2 * r + CLEARANCE) return false;
    return true;
  };

  const half = p.arena.size / 2 - r;
  const wholeRoom: Region = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  const place = (region: Region): Pose => {
    let pose: Pose = { x: 0, z: 0, yaw: 0 };
    for (const area of [region, wholeRoom]) {
      for (let t = 0; t < TRIES; t++) {
        pose = { x: rng.range(area.minX, area.maxX), z: rng.range(area.minZ, area.maxZ), yaw: rng.range(-Math.PI, Math.PI) };
        if (isClear(pose.x, pose.z)) return pose;
      }
    }
    return pose;
  };

  for (let i = 0; i < hiders; i++) agents.push(place(room.hiderSpawn));
  for (let i = 0; i < seekers; i++) agents.push(place(room.seekerSpawn));
  return { agents, boxes };
}
