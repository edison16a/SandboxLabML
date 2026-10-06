/**
 * A second hand-written seeker that only the measurement script uses. No
 * run trains against it, so hidden time against it shows whether hiders
 * learned to hide in general or only learned the scripted seeker's habits.
 * It searches differently on purpose: it stops to turn a full circle, then
 * walks a few seconds in a straight line, instead of sweeping in curves.
 */
import { clamp } from '../../src/engine/core/math';
import type { AgentController, TickIO } from '../../src/engine/env/types';
import { bearing, v1HideSeekController, type HideSeekAgent } from '../../src/engine/hideseek';
import { blockedAhead, openSide } from '../../src/engine/hideseek/scriptedMoves';

/** Seconds of one search cycle: a turn on the spot, then a walk. */
const CYCLE = 5;
/** Seconds of each cycle spent turning. A full circle at full turn takes about 2.1 s. */
const SCAN = 2.2;
/** How long it heads for the last sighting before searching again, s. */
const CHASE_MEMORY = 3;

export const scannerSeekerController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    v1HideSeekController.tick(a, io);
    io.action[2] = -1;
    io.action[3] = -1;
    io.action[0] = 0;
    io.action[1] = 0;
    if (a.prep) return;
    if (a.seesOpponent || a.lastSeenAge < CHASE_MEMORY) {
      const dx = a.lastSeenX - a.x;
      const dz = a.lastSeenZ - a.z;
      if (a.seesOpponent || Math.hypot(dx, dz) > 0.8) {
        const b = bearing(dx, dz, a.yaw);
        io.action[0] = Math.abs(b) < 1 ? 1 : 0.2;
        io.action[1] = clamp(b * 2, -1, 1);
        return;
      }
    }
    search(a, io);
  },
};

/** Turn a circle on the spot, then walk straight, turning away from walls. */
function search(a: HideSeekAgent, io: TickIO): void {
  const phase = a.time % CYCLE;
  if (phase < SCAN) {
    io.action[1] = -1;
    return;
  }
  if (blockedAhead(a)) {
    io.action[0] = 0.3;
    io.action[1] = openSide(a);
    return;
  }
  io.action[0] = 1;
}
