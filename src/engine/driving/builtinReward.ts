import type { AgentController, TickIO } from '../env/types';
import type { DrivingLearner } from './agent/learner';

/** Seconds of unexplained standing still before the built in reward calls a learner stuck. */
export const STUCK_AFTER = 8;

/**
 * The reward used when a run has no script. Progress pays a little per
 * meter and arriving pays most. Rules broken while driving on cost a
 * little; the episode itself ends a learner on a crash, a person hit, the
 * curb, a wrong turn or arrival (see DrivingEnv), so the ground it never
 * covers is the main price of a crash. On the first level only the car's
 * center leaving the road ends it, and a wheel over the curb costs a little
 * each tick: early brains that try to drive and clip a corner must still
 * beat brains that never move. As a script it would read:
 *
 *   drive(steer: brain.steer, pedal: brain.pedal)
 *   reward +0.02 * progress.gain
 *   reward +10 when arrived
 *   reward +0.015 * (1 - car.speed / 8) when remaining < 30 m (0.06 inside the zone)
 *   reward -2 when ranRedLight
 *   reward -0.3 when overranStopLine
 *   reward -0.005 when speeding
 *   reward -0.01 when wrongWay
 *   reward -0.002 when laneDeparture
 *   reward -0.01 when overCurb (only lenient levels let a car carry on)
 *   reward -2 when crashed
 *   reward -4 when hitPedestrian
 *   stop "stuck" when noProgress > 8 s
 */
export const builtinDrivingController: AgentController<DrivingLearner> = {
  customSensorCount: 0,
  sensors() {},
  tick(l: DrivingLearner, io: TickIO) {
    io.action[0] = io.brain[0];
    io.action[1] = io.brain[1];
    let r = 0.02 * l.progressGain;
    if (l.arrived) r += 10;
    // Slowing down on the way into the destination zone pays a little, the trail that leads to stopping there.
    if (l.remaining < 30 && l.remaining > -7) r += (l.inDestination ? 0.06 : 0.015) * (1 - Math.min(1, l.car.speed / 8));
    if (l.ranRedLight) r -= 2;
    if (l.overranStopLine) r -= 0.3;
    if (l.speeding) r -= 0.005;
    if (l.wrongWay) r -= 0.01;
    if (l.laneDeparture) r -= 0.002;
    if (l.overCurb) r -= 0.01;
    if (l.crashed) r -= 2;
    if (l.hitPedestrian) r -= 4;
    io.reward = r;
    if (l.noProgress > STUCK_AFTER) io.stop = 'stuck';
  },
};
