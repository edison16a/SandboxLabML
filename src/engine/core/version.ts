/**
 * Bump ENGINE_VERSION whenever a change could alter Racing results
 * (physics, sensors, network evaluation, float order). Stored genomes carry
 * the version they were trained under, and replays refuse a mismatch rather
 * than show a wrong path.
 */
export const ENGINE_VERSION = 1;

/**
 * The same rule for Hide and Seek, kept apart so a change to one game never
 * blocks replays of the other. Version 2 added ramps, climbing and locks
 * for both teams, which changes every match.
 */
export const HIDESEEK_ENGINE_VERSION = 2;

/** The engine version a run of `env` is stamped with and checked against. */
export function engineVersionOf(env: 'racing' | 'hideseek'): number {
  return env === 'hideseek' ? HIDESEEK_ENGINE_VERSION : ENGINE_VERSION;
}

/** Bump when the Racing benchmark's tracks, seeds or scoring change. */
export const BENCHMARK_VERSION = 1;

/**
 * Bump when the Hide and Seek benchmark's rooms, start seeds, match count
 * or scoring change, or when the shipped reference champions do, since
 * they are the opponents. It is separate from the Racing one, so a change
 * to one exam never forces the other's reference file to be rebuilt.
 */
export const HIDESEEK_BENCHMARK_VERSION = 4;

/** Bump when the script API changes in a way old scripts cannot express. */
export const SCRIPT_API_VERSION = 1;
