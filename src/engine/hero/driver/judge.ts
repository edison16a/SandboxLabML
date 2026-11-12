import { STATUS_ARRIVED, STATUS_DRIVING, type DrivingLearner } from '../../driving/agent/learner';
import { builtinDrivingController } from '../../driving/builtinReward';
import { SUV } from '../../driving/car/params';
import { DrivingEnv, type DrivingBrain } from '../../driving/env';
import type { DrivingInputConfig } from '../../driving/sensors/inputConfig';
import { drivingEnvOptions, type DrivingSetup } from '../../driving/setup';
import { LIGHT_RED } from '../../driving/signals/plan';
import { Network } from '../../neat/network';
import type { Genome } from '../../neat/types';
import { carAtCamera } from './camera';
import { parkedClash, PARKED_TICKS } from './parked';
import { PERSON_NEAR, RED_NEAR, STILL } from './status';

/** How one hero trip went, from a headless drive of the whole trip. */
export interface TripReport {
  arrived: boolean;
  /** The first hero rule broken, in plain words, or null when every rule held. */
  broke: string | null;
  /** Seconds to the arrival (or to wherever it stopped). */
  seconds: number;
  /** How many times it came to a stand at a red light, and the longest such wait, s. */
  redStops: number;
  redWait: number;
  /** Longest stand for a person in its way, s. */
  personWait: number;
  /** Left and right turns on the route (straight through a junction does not count). */
  turns: number;
  /** Mean change of the steering command per tick: a weaving SUV looks broken in a chase camera. */
  weave: number;
  /** Seconds off the lane center by more than the lane allows. */
  laneDeparture: number;
}

/** True when any bit of a contact set is on. */
const touching = (words: Uint32Array) => words.some((w) => w !== 0);

/**
 * The rule a learner broke on its latest tick, if any. The hero SUV must
 * never crash, hit a person, run a red, roll over a stop line on red,
 * drive the wrong way or put a wheel over the curb. Traffic and people
 * cannot see the SUV and pass through it without it counting as a crash,
 * which looks broken on screen, so the hero also asks that nothing ever
 * touches it.
 */
export function brokenRule(l: DrivingLearner): string | null {
  if (l.crashed) return 'crashed';
  if (touching(l.carContacts)) return 'touched a car';
  if (touching(l.pedContacts)) return 'touched a person';
  if (l.hitPedestrian) return 'hit a person';
  if (l.ranRedLight) return 'ran a red light';
  if (l.overranStopLine) return 'rolled over a stop line';
  if (l.wrongWay) return 'drove the wrong way';
  if (l.overCurb) return 'put a wheel over the curb';
  if (l.offRoad) return 'left the road';
  return null;
}

/** A fresh env for one trip with `brain` at the wheel, the way the landing page builds it. */
export function tripEnv(brain: DrivingBrain, inputs: DrivingInputConfig, brainSeed: number, setup: DrivingSetup): DrivingEnv {
  const env = new DrivingEnv(drivingEnvOptions(setup, SUV, inputs, builtinDrivingController));
  env.reset([brain], [brainSeed], [0]);
  return env;
}

/**
 * Drives one trip to its end, alone, and reports how it went. The city
 * runs on through the hold after the arrival too, as it does on the page,
 * so nothing may touch the parked SUV or pass the camera then either.
 */
export function judgeTrip(genome: Genome, inputs: DrivingInputConfig, brainSeed: number, setup: DrivingSetup): TripReport {
  const env = tripEnv(new Network(genome), inputs, brainSeed, setup);
  const l = env.learners[0];
  let broke: string | null = null;
  let red = 0;
  let person = 0;
  let redStops = 0;
  let redWait = 0;
  let personWait = 0;
  let weave = 0;
  let lastSteer = 0;
  while (l.status === STATUS_DRIVING) {
    env.step();
    broke ??= brokenRule(l) ?? (carAtCamera(env) ? 'had a car at the camera' : null);
    const still = l.car.speed < STILL;
    const atRed = still && l.sense.light === LIGHT_RED && l.sense.lightDistance < RED_NEAR;
    if (atRed && red === 0) redStops++;
    red = atRed ? red + 1 : 0;
    person = still && l.sense.ped >= 0 && l.sense.pedDistance < PERSON_NEAR ? person + 1 : 0;
    redWait = Math.max(redWait, red);
    personWait = Math.max(personWait, person);
    weave += Math.abs(l.car.steerCmd - lastSteer);
    lastSteer = l.car.steerCmd;
  }
  const arrived = l.status === STATUS_ARRIVED;
  const ticks = env.tick;
  if (!arrived) broke ??= `stopped: ${l.stopReason ?? 'unknown'}`;
  for (let k = 0; k < PARKED_TICKS && broke === null; k++) {
    env.step();
    broke = parkedClash(env);
  }
  const dt = 1 / 30;
  return {
    arrived,
    broke,
    seconds: l.time,
    redStops,
    redWait: redWait * dt,
    personWait: personWait * dt,
    turns: env.opts.route.turns.filter((t) => t.turn !== 0).length,
    weave: weave / Math.max(1, ticks),
    laneDeparture: l.laneDepartureTime,
  };
}
