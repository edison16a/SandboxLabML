import { clamp, wrapAngle } from '../core/math';
import type { AgentController, TickIO } from '../env/types';
import { NEVER_SEEN_AGE, type HideSeekAgent } from './agents/agent';
import { bearing } from './frame';
import { v1HideSeekController } from './rewards';
import { sweep } from './scriptedMoves';

/** How long the hider keeps running from the last sighting before it calms down, s. */
const FLEE_MEMORY = 3;
/** Seconds of prep spent turning on the spot to find the seeker. */
const LOOK_AROUND = 2;
/** Wandering speed when no seeker is in mind, as a share of full speed. */
const WANDER_SPEED = 0.5;
/** Free space beyond this along a ray adds nothing to an escape route's score, m. */
const ENOUGH_ROOM = 6;
/** How much heading away from the seeker counts against free space when picking a route. */
const AWAY_WEIGHT = 4;

/**
 * A hand-written hider with no brain, the yardstick for seekers that the
 * scripted seeker is for hiders. It looks around at the start of prep,
 * runs away from wherever it last saw the seeker, and otherwise wanders
 * slowly with the same wall avoidance as the scripted seeker. It never
 * touches boxes. It only reads its own view, like a brain.
 *
 * Seen time against it is a fair measure of seeker skill: co-evolved
 * hiders improve along with the seekers, but this one never changes. It
 * scores itself with the v1 rewards.
 */
export const scriptedHiderController: AgentController<HideSeekAgent> = {
  customSensorCount: 0,
  sensors() {},
  tick(a: HideSeekAgent, io: TickIO) {
    v1HideSeekController.tick(a, io);
    io.action[2] = -1;
    io.action[3] = -1;
    if (a.seesOpponent || a.lastSeenAge < FLEE_MEMORY) {
      flee(a, io);
      return;
    }
    if (a.prep && a.lastSeenAge >= NEVER_SEEN_AGE && a.time < LOOK_AROUND) {
      io.action[0] = 0;
      io.action[1] = 1;
      return;
    }
    sweep(a, io, WANDER_SPEED);
  },
};

/**
 * Runs along the ray that best combines free space with pointing away from
 * the last sighting, so it goes round boxes and walls instead of running
 * into them. Ray i points 2 PI i / n to the left of the facing.
 */
function flee(a: HideSeekAgent, io: TickIO): void {
  const away = wrapAngle(bearing(a.lastSeenX - a.x, a.lastSeenZ - a.z, a.yaw) + Math.PI);
  const r = a.rays;
  const n = r.length;
  let target = away;
  let best = -Infinity;
  for (let i = 0; i < n; i++) {
    const angle = wrapAngle((2 * Math.PI * i) / n);
    const score = Math.min(r[i], ENOUGH_ROOM) + AWAY_WEIGHT * Math.cos(angle - away);
    if (score > best) {
      best = score;
      target = angle;
    }
  }
  io.action[0] = Math.abs(target) < 1 ? 1 : 0.3;
  io.action[1] = clamp(target * 2, -1, 1);
}
