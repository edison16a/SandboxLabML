import { countLocks } from '../match/sync';
import type { SandboxState } from './state';

/**
 * Distances and counts that scripts and script sensors read directly, the
 * Sandbox version of updateDerived. The opponent distance is to the
 * agent's target (see SandboxVision); with no opponent at all it reads as
 * the room's diagonal, the farthest anyone can be.
 */
export function updateSandboxDerived(s: SandboxState): void {
  const far = s.physics.arena.size * Math.SQRT2;
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    const t = s.targets[i];
    a.opponentDistance = t >= 0 ? Math.hypot(s.agents[t].x - a.x, s.agents[t].z - a.z) : far;
    countLocks(s.boxes, a);
    let nearest = Infinity;
    for (const b of s.boxes) nearest = Math.min(nearest, Math.hypot(b.x - a.x, b.z - a.z));
    a.nearestBoxDistance = nearest === Infinity ? far : nearest;
  }
}
