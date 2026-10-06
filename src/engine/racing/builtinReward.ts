import type { AgentController, TickIO } from '../env/types';
import type { RacingCar } from './car/runtime';

/**
 * The reward used when a run has no script. It matches the Intermediate
 * preset script line for line, but runs as plain TypeScript so it doubles as
 * the speed baseline that compiled scripts are measured against.
 *
 *   drive(steer: brain.steer, pedal: brain.pedal)
 *   reward +1 when checkpoint.passed
 *   reward +10 when lap.completed
 *   reward +0.002 * car.speed
 *   stop "crash" when car.offTrack
 *   stop "stalled" when car.noProgress > 3 s
 */
export const builtinRacingController: AgentController<RacingCar> = {
  customSensorCount: 0,
  sensors() {},
  tick(rc: RacingCar, io: TickIO) {
    io.action[0] = io.brain[0];
    io.action[1] = io.brain[1];
    let r = 0.002 * rc.car.speed;
    if (rc.checkpointPassed) r += 1;
    if (rc.lapCompleted) r += 10;
    io.reward = r;
    if (rc.offTrack) io.stop = 'crash';
    else if (rc.noProgress > 3) io.stop = 'stalled';
  },
};
