import type { TickIO } from '../env/types';
import type { HideSeekAgent } from './agents/agent';

/** Closer than this to a wall ahead, a scripted agent turns toward open space, m. */
const WALL_AHEAD = 2;

/**
 * Whether a wall or box is close in front, judged from the rays straight
 * ahead and just either side. Rays start ahead and go round to the left.
 */
export function blockedAhead(a: HideSeekAgent): boolean {
  const r = a.rays;
  const n = r.length;
  return n > 0 && Math.min(r[0], r[1 % n], r[(n - 1) % n]) < WALL_AHEAD;
}

/** +1 to turn left, -1 to turn right: toward whichever side has more room. */
export function openSide(a: HideSeekAgent): number {
  const r = a.rays;
  const n = r.length;
  const left = r[Math.round(n / 8) % n] + r[Math.round(n / 4) % n];
  const right = r[(n - Math.round(n / 8)) % n] + r[(n - Math.round(n / 4)) % n];
  return left >= right ? 1 : -1;
}

/**
 * Long curves through the room at `speed` (0 to 1), turning toward the
 * more open side when a wall is close ahead. Shared by the scripted seeker
 * and the scripted hider, so both yardsticks wander the same way.
 */
export function sweep(a: HideSeekAgent, io: TickIO, speed = 1): void {
  if (blockedAhead(a)) {
    io.action[0] = 0.3 * speed;
    io.action[1] = openSide(a);
    return;
  }
  io.action[0] = speed;
  io.action[1] = Math.sin(a.time * 0.5) * 0.6;
}
