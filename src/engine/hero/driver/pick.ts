import type { DrivingInputConfig } from '../../driving/sensors/inputConfig';
import type { Genome } from '../../neat/types';
import { heroTrip } from './file';
import { judgeTrip, type TripReport } from './judge';

/** A trained brain the hero could show, with what it needs to drive. */
export interface DriverCandidate {
  /** Where it comes from, in plain words. */
  label: string;
  genome: Genome;
  blueprint: string;
  inputs: DrivingInputConfig;
  brainSeed: number;
}

/** One trip a candidate drove, by its seed. */
export interface TripPick {
  seed: number;
  report: TripReport;
}

/**
 * What a hero trip may be: long enough to show a few blocks and short
 * enough that the loop moves on, with waits at lights and for people that
 * read as care rather than a stall.
 */
export const SHOWABLE = { minSeconds: 16, maxSeconds: 75, maxWait: 24, maxLaneDeparture: 1, maxWeave: 0.08 };

/** True when a trip is fit for the hero: a clean arrival within the limits above. */
export function showable(r: TripReport): boolean {
  const s = SHOWABLE;
  return r.arrived && r.broke === null && r.seconds >= s.minSeconds && r.seconds <= s.maxSeconds && r.redWait <= s.maxWait && r.personWait <= s.maxWait && r.laneDeparture <= s.maxLaneDeparture && r.weave <= s.maxWeave;
}

/** Drives a candidate on every trip seed and keeps the trips fit for the hero. */
export function showableTrips(c: DriverCandidate, city: string, level: number, seeds: readonly number[]): TripPick[] {
  const out: TripPick[] = [];
  for (const seed of seeds) {
    const setup = heroTrip(city, level, seed);
    if (!setup) continue;
    const report = judgeTrip(c.genome, c.inputs, c.brainSeed, setup);
    if (showable(report)) out.push({ seed, report });
  }
  return out;
}

/** How much a trip shows of what the SUV has learned: stopping at a red, waiting for a person, a turn. */
export function interest(r: TripReport): number {
  return (r.redStops > 0 ? 3 : 0) + (r.personWait > 0.8 ? 3 : 0) + Math.min(2, r.turns) - r.weave * 20;
}

/**
 * The trips the loop plays, in order, at most `count` and about
 * `budget` seconds in all. It makes sure the loop shows a red light stop
 * and a stop for a person when the candidate has them, then fills up with
 * the most interesting trips left. Ties go to the lower seed, so the same
 * trips always give the same loop.
 */
export function chooseLoop(trips: readonly TripPick[], count: number, budget: number): TripPick[] {
  const pool = [...trips].sort((a, b) => interest(b.report) - interest(a.report) || a.seed - b.seed);
  const chosen: TripPick[] = [];
  let seconds = 0;
  const take = (t: TripPick | undefined) => {
    if (!t || chosen.includes(t) || chosen.length >= count || seconds + t.report.seconds > budget) return;
    chosen.push(t);
    seconds += t.report.seconds;
  };
  take(pool.find((t) => t.report.redStops > 0 && t.report.personWait > 0.8));
  take(pool.find((t) => t.report.redStops > 0 && !chosen.includes(t)));
  take(pool.find((t) => t.report.personWait > 0.8 && !chosen.includes(t)));
  for (const t of pool) take(t);
  return chosen;
}
