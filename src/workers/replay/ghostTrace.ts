import type { EpisodeEnv, EpisodeResult, GhostTrace } from '@/engine/env/episode';

export interface GhostTelemetry {
  generation: number;
  /** Grid slot the agent started from; 0 is where training starts. */
  slot: number;
  /** Progress along the course per tick. Negative until an agent from a back slot reaches the line. */
  distance: Float32Array;
  speed: Float32Array;
  /** Brake per tick, 0 to 1, for the brake map. */
  brake: Float32Array;
  /**
   * Where the replay ended in a crash, if it did, and how many meters the
   * agent covered from its own grid slot to get there. The Sandbox draws
   * crash rings from this, since its content is not the one the records
   * were made on.
   */
  crash: { x: number; y: number; driven: number } | null;
}

/** Runs one ghost's env to the end and keeps the env's trace numbers for every tick. */
export function traceGhost(env: EpisodeEnv, trace: GhostTrace<EpisodeResult>, generation: number, slot: number): GhostTelemetry {
  const dist: number[] = [];
  const speed: number[] = [];
  const brake: number[] = [];
  const sample = new Float64Array(3);
  while (!env.done) {
    env.step();
    trace.sample(env, 0, sample);
    dist.push(sample[0]);
    speed.push(sample[1]);
    brake.push(sample[2]);
  }
  const at = trace.crash(env.results()[0]);
  const driven = Math.max(0, (dist[dist.length - 1] ?? 0) - (dist[0] ?? 0));
  return { generation, slot, distance: Float32Array.from(dist), speed: Float32Array.from(speed), brake: Float32Array.from(brake), crash: at ? { ...at, driven } : null };
}
