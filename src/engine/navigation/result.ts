import { NAV_DIED, NAV_FINISHED, type NavAgent } from './agent';

/** Per agent outcome of an episode, used for fitness, stats and the champion record. */
export interface NavigationResult {
  fitness: number;
  /** Best share of the walking distance covered, 0 to 1. */
  progress: number;
  finished: boolean;
  /** Seconds to the finish, or 0 when it did not finish. */
  finishTime: number;
  died: boolean;
  /** "spikes" or "crushed" when it died, else null. */
  deathCause: string | null;
  /** Why the run ended: "finished", "spikes", "crushed", "time", "stuck" or a script's own word. */
  stopReason: string | null;
  /** Seconds the run lasted. */
  time: number;
  /** Where it ended, m, so a chart or a heat map can show where agents fail. */
  endX: number;
  endZ: number;
}

export function resultOf(a: NavAgent): NavigationResult {
  const died = a.status === NAV_DIED;
  return {
    fitness: a.fitness,
    progress: a.bestProgress,
    finished: a.status === NAV_FINISHED,
    finishTime: a.finishTime,
    died,
    deathCause: died ? a.stopReason : null,
    stopReason: a.stopReason,
    time: a.time,
    endX: a.x,
    endZ: a.z,
  };
}
