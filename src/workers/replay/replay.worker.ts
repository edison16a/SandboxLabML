/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { EpisodeSetup } from '@/engine/env/episode';
import { loadEpisodeModule } from '@/engine/env/registry';
import type { RunConfig } from '@/engine/training/runConfig';
import { runBenchmark } from '@/engine/bench';
import type { Genome } from '@/engine/neat/types';
import { StreamSender } from '../shared/streamPort';
import { rehearseScene } from './ghostEnvs';
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
   * Plays a scene to the end off screen and gives each ghost's result, so
   * a lab can check a scene before it shows it. It leaves the replay alone.
   */
  async rehearse(env: string, setup: EpisodeSetup, specs: GhostSpec[]) {
    return rehearseScene(await loadEpisodeModule(env), setup, specs);
  },
  /**
   * Scores a champion on the benchmark at low priority: the exam pauses
   * after every episode, so ghost frames keep playing in between.
   */
  async benchmark(config: RunConfig, model: Genome) {
    const result = await runBenchmark(config, model);
    return result ? { score: result.score, radar: result.radar } : null;
  },
};

export type ReplayApi = typeof api;
Comlink.expose(api);
