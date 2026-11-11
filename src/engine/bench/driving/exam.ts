import { mixSeed } from '../../core/rng';
import { Autopilot } from '../../driving/autopilot/autopilot';
import { autopilotController, IDLE_BRAIN } from '../../driving/autopilot/controller';
import { builtinDrivingController } from '../../driving/builtinReward';
import { SUV } from '../../driving/car/params';
import { builtInCity, HELD_OUT_CITY_IDS } from '../../driving/city/presets';
import { DrivingEnv } from '../../driving/env';
import { drivingLevel } from '../../driving/levels';
import type { RouteOptions } from '../../driving/route/planner';
import { STANDARD_DRIVING_INPUTS } from '../../driving/sensors/inputConfig';
import { createDrivingSetup, drivingEnvOptions, type DrivingSetup } from '../../driving/setup';
import { driveToEnd } from './steps';

/** The levels the exam drives: everything past empty streets, since a brain that only steers has not learned the rules. */
export const EXAM_LEVELS = [2, 3, 4, 5] as const;

/**
 * Two trips per city and level: one through a single turn, one straight
 * along a street. They are short at every level, rush hour included, so
 * the whole exam stays a few seconds of work and each trip tests the
 * level's rules rather than stamina.
 */
const TRIPS: ReadonlyArray<{ id: string; label: string; route: RouteOptions }> = [
  { id: 'turn', label: 'a turn', route: { minLength: 160, maxLength: 320, minTurns: 1, maxTurns: 1 } },
  { id: 'straight', label: 'straight on', route: { minLength: 160, maxLength: 320, minTurns: 0, maxTurns: 0 } },
];

/** Salt of the exam's trip seeds, so they never line up with a training trip. */
const EXAM_SALT = 0xe7a3;

/** What the autopilot needs on a trip. Efficiency is scored against its pace, so 100% means autopilot pace. */
export interface DrivingPar {
  /** Seconds from the start to arriving. */
  time: number;
  /** Meters from the start to the middle of the destination zone. */
  length: number;
}

export interface DrivingExamCourse {
  id: string;
  label: string;
  city: string;
  level: number;
  setup: DrivingSetup;
  par: DrivingPar;
}

/**
 * Drives the autopilot alone on a trip, with the built in rules, to time
 * it. It knows the city perfectly, so its time is the pace a brain is
 * measured against. It pauses now and then, like the exam itself, so a
 * worker that also plays ghosts keeps them moving.
 */
export async function parFor(setup: DrivingSetup): Promise<DrivingPar & { arrived: boolean; safe: boolean }> {
  const pilots: Autopilot[] = [];
  const opts = drivingEnvOptions(setup, SUV, STANDARD_DRIVING_INPUTS, autopilotController(pilots, builtinDrivingController));
  const env = new DrivingEnv(opts);
  env.reset([IDLE_BRAIN]);
  pilots.push(new Autopilot(opts.city, opts.route, env.world.state, SUV));
  await driveToEnd(env);
  const r = env.results()[0];
  return { time: r.time, length: opts.route.destS - opts.route.startS, arrived: r.arrived, safe: r.safe };
}

/** The exam's trips without their par, which is the slow part: two held out cities, four levels, two trips each. */
export function examSetups(): Array<Omit<DrivingExamCourse, 'par'>> {
  return HELD_OUT_CITY_IDS.flatMap((cityId, ci) => {
    const city = builtInCity(cityId)!;
    return EXAM_LEVELS.flatMap((level) =>
      TRIPS.map((trip, ti) => ({
        id: `${cityId}-${level}-${trip.id}`,
        label: `${city.name}, ${drivingLevel(level).name.toLowerCase()}, ${trip.label}`,
        city: cityId,
        level,
        setup: createDrivingSetup({ city, level, seed: mixSeed(EXAM_SALT, ci, level, ti), route: trip.route }),
      })),
    );
  });
}

let cached: Promise<DrivingExamCourse[]> | null = null;

async function buildExam(): Promise<DrivingExamCourse[]> {
  const out: DrivingExamCourse[] = [];
  for (const c of examSetups()) {
    const { time, length } = await parFor(c.setup);
    out.push({ ...c, par: { time, length } });
  }
  return out;
}

/**
 * The whole exam with par for every trip. Timing the autopilot takes a
 * few seconds, so it is done once per thread and shared. Everything in it
 * comes from fixed data, so every thread builds the same exam.
 */
export function drivingExam(): Promise<DrivingExamCourse[]> {
  cached ??= buildExam();
  return cached;
}
