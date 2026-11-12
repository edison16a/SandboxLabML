/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { EpisodeSetup } from '@/engine/env/episode';
import type { RunConfig } from '@/engine/training/runConfig';
import { runBenchmark } from '@/engine/bench';
import type { Genome } from '@/engine/neat/types';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

/**
 * The replay worker re-simulates stored genomes: ghosts for overlay
 * generations and the Sandbox, and the benchmark. It is separate from
 * training so watching never slows training down.
 */
let ghosts: GhostPlayer | null = null;

const api = {
  connect(streamPort: MessagePort) {
    ghosts = new GhostPlayer(new StreamSender(streamPort, 'ghosts'));
  },
  /**
   * Champions of any episode env to replay on one setup, such as one trip
   * through the city. Resolves once the env's module has loaded and the
   * scene is in place.
   */
  async setGhostScene(env: string, setup: EpisodeSetup, specs: GhostSpec[]) {
    await ghosts?.setScene(env, setup, specs);
  },
  playGhosts(speed: number, loop: boolean, warmup?: number) {
    ghosts?.play(speed, loop, warmup);
  },
  setGhostSpeed(speed: number) {
    ghosts?.setSpeed(speed);
  },
  setGhostsPaused(paused: boolean) {
    ghosts?.setPaused(paused);
  },
  stopGhosts() {
    ghosts?.stop();
  },
  /**
   * Scores a champion on the benchmark at low priority: the exam pauses
   * after every episode, so ghost frames keep playing in between.
   */
  async benchmark(config: RunConfig, model: Genome) {
    const result = await runBenchmark(config, model);
    return result ? { score: result.score, radar: result.radar } : null;
  },
  ghostTelemetry() {
    const t = ghosts?.telemetry() ?? [];
    return Comlink.transfer(
      t,
      t.flatMap((g) => [g.distance.buffer as ArrayBuffer, g.speed.buffer as ArrayBuffer, g.brake.buffer as ArrayBuffer]),
    );
  },
};

export type ReplayApi = typeof api;
Comlink.expose(api);
