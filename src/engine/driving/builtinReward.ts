import type { AgentController, TickIO } from '../env/types';
import type { DrivingLearner } from './agent/learner';
import { LIGHT_RED } from './signals/plan';

/** Seconds of unexplained standing still before the built in reward calls a learner stuck. */
export const STUCK_AFTER = 8;
/** The last stretch before the destination, m, where slow new ground pays extra. */
export const APPROACH = 30;
/** Arriving pays this. */
export const ARRIVE_BONUS = 10;
/** Standing at a red light, at most this far before its line, m, pays WAIT_PAY a tick. */
export const WAIT_NEAR = 25;
export const WAIT_PAY = 0.005;

/**
 * The reward used when a run has no script. Progress pays a little per
 * meter and arriving pays most. Running a red light ends the trip, like a
 * crash: a cost that only showed up at the destination would teach
 * nothing to the brains that never get there, while losing the rest of
 * the trip teaches every brain to wait at the line, and standing at a red
 * pays a little, so a brain that brakes for one is ahead at once rather
 * than only later. A red lasts 22 s, so that pays at most about 3, less
 * than arriving. Over the last 30 m,
 * new ground pays more the slower it is covered, the trail that leads to
 * stopping in the zone. It pays per meter, not per second, so parking short
 * of the zone earns nothing. Other rules cost a little per tick; the
 * episode itself ends a learner on a crash, a person hit, the curb, a wrong
 * turn or arrival (see DrivingEnv). As a script it would read:
 *
 *   drive(steer: brain.steer, pedal: brain.pedal)
 *   reward +0.02 * route.gain
 *   reward +0.1 * route.gain * (1 - car.speed / 8 m/s) when route.remaining < 30 m
 *   reward +10 when car.arrived
 *   reward +0.005 when light.state is red and light.distance < 25 m and car.speed < 1 m/s
 *   reward -2 when rules.ranRedLight
 *   reward -0.3 when rules.overranStopLine
 *   reward -0.005 when rules.speeding
 *   reward -0.01 when rules.wrongWay
 *   reward -0.002 when rules.laneDeparture
 *   reward -0.01 when car.overCurb (only lenient levels let a car carry on)
 *   reward -2 when car.crashed
 *   reward -4 when car.hitPedestrian
 *   stop "redlight" when rules.ranRedLight
 *   stop "stuck" when car.noProgress > 8 s
 */
export const builtinDrivingController: AgentController<DrivingLearner> = {
  customSensorCount: 0,
  sensors() {},
  tick(l: DrivingLearner, io: TickIO) {
    io.action[0] = io.brain[0];
    io.action[1] = io.brain[1];
    let r = 0.02 * l.progressGain;
    if (l.remaining < APPROACH) r += 0.1 * l.progressGain * (1 - Math.min(1, l.car.speed / 8));
    if (l.arrived) r += ARRIVE_BONUS;
    if (l.sense.light === LIGHT_RED && l.sense.lightDistance < WAIT_NEAR && l.car.speed < 1) r += WAIT_PAY;
    if (l.ranRedLight) r -= 2;
    if (l.overranStopLine) r -= 0.3;
    if (l.speeding) r -= 0.005;
    if (l.wrongWay) r -= 0.01;
    if (l.laneDeparture) r -= 0.002;
    if (l.overCurb) r -= 0.01;
    if (l.crashed) r -= 2;
    if (l.hitPedestrian) r -= 4;
    io.reward = r;
    if (l.ranRedLight) io.stop = 'redlight';
    else if (l.noProgress > STUCK_AFTER) io.stop = 'stuck';
  },
};
