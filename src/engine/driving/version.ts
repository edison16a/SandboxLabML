/**
 * Bump whenever a change could alter Driving results: the car, the city,
 * the sensors, the rules, the built in reward or how trips are picked.
 * Runs and references store it, and replays refuse a mismatch rather than
 * show a drive that never happened. It is the Driving env's own number, so
 * a change here never blocks another lab's replays.
 */
export const DRIVING_ENGINE_VERSION = 1;

/**
 * Bump when the Driving benchmark's cities, routes, levels, seeds or
 * scoring change. Scores only compare within one version, and the
 * reference file stores the version it was built for.
 */
export const DRIVING_BENCHMARK_VERSION = 2;
