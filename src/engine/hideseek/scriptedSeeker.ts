import { clamp } from '../core/math';
import type { AgentController, TickIO } from '../env/types';
import type { HideSeekAgent } from './agents/agent';
import { bearing } from './frame';
import { v1HideSeekController } from './rewards';

/** How long the seeker keeps heading for the last sighting before it goes back to sweeping, s. */
const CHASE_MEMORY = 4;
/** Closer than this to a wall ahead, the seeker turns toward open space, m. */
const WALL_AHEAD = 2;

/**
 * A hand-written seeker with no brain. It chases what it sees, heads for
 * the last sighting for a few seconds, and otherwise sweeps the room in
 * long curves, turning toward open space near walls. It only reads its own
 * view (sight and rays), the same information a brain gets.
 *
 * It is a fixed yardstick, like Racing's scripted driver: co-evolution
 * alone cannot show whether hiders got better, because their opponents
 * improve too, but hidden time against this seeker can. Evolved brains
 * never train against it. It scores itself with the v1 rewards.
 */
export const scriptedSeekerController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    v1HideSeekController.tick(a, io);
    io.action[2] = -1;
    io.action[3] = -1;
    if (a.prep) {
      io.action[0] = 0;
      io.action[1] = 0;
      return;
    }
    if (a.seesOpponent || a.lastSeenAge < CHASE_MEMORY) {
      const dx = a.lastSeenX - a.x;
      const dz = a.lastSeenZ - a.z;
      const close = Math.hypot(dx, dz) < 0.8;
      if (a.seesOpponent || !close) {
        const b = bearing(dx, dz, a.yaw);
        io.action[0] = Math.abs(b) < 1 ? 1 : 0.2;
        io.action[1] = clamp(b * 2, -1, 1);
        return;
      }
    }
    sweep(a, io);
  },
};

/** Long curves through the room, turning toward the more open side when a wall is close ahead. */
function sweep(a: HideSeekAgent, io: TickIO): void {
  const r = a.rays;
  const n = r.length;
  if (n === 0) {
    io.action[0] = 1;
    io.action[1] = Math.sin(a.time * 0.5) * 0.6;
    return;
  }
  const ahead = Math.min(r[0], r[1 % n], r[(n - 1) % n]);
  if (ahead < WALL_AHEAD) {
    const left = r[Math.round(n / 8) % n] + r[Math.round(n / 4) % n];
    const right = r[(n - Math.round(n / 8)) % n] + r[(n - Math.round(n / 4)) % n];
    io.action[0] = 0.3;
    io.action[1] = left >= right ? 1 : -1;
    return;
  }
  io.action[0] = 1;
  io.action[1] = Math.sin(a.time * 0.5) * 0.6;
}
