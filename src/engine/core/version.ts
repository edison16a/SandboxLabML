/**
 * Bump ENGINE_VERSION whenever a change could alter simulation results
 * (physics, sensors, network evaluation, float order). Stored genomes carry
 * the version they were trained under, and replays refuse a mismatch rather
 * than show a wrong path.
 */
export const ENGINE_VERSION = 1;

/** Bump when benchmark tracks, seeds or scoring change. */
export const BENCHMARK_VERSION = 1;

/** Bump when the script API changes in a way old scripts cannot express. */
export const SCRIPT_API_VERSION = 1;
