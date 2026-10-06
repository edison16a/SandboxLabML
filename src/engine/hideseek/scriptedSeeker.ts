import { clamp } from '../core/math';
import type { AgentController, TickIO } from '../env/types';
import type { HideSeekAgent } from './agents/agent';
import { bearing } from './frame';
import { v1HideSeekController } from './rewards';
import { sweep } from './scriptedMoves';

/** How long the seeker keeps heading for the last sighting before it goes back to sweeping, s. */
const CHASE_MEMORY = 4;

/**
 * A hand-written seeker with no brain. It chases what it sees, heads for
 * the last sighting for a few seconds, and otherwise sweeps the room in
 * long curves, turning toward open space near walls. It only reads its own
 * view (sight and rays), the same information a brain gets.
 *
 * It is a fixed yardstick, like Racing's scripted driver: co-evolution
 * alone cannot show whether hiders got better, because their opponents
 * improve too, but hidden time against this seeker can. Runs with
 * scripted rounds (the v2 setup) also use it as a sparring partner, so
 * scripts/measure-hideseek.ts checks hiders against a second, held-out
 * seeker as well. It scores itself with the v1 rewards.
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
