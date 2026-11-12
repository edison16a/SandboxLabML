/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { RunConfig } from '@/engine/training/runConfig';
import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import { loadEpisodeModule } from '@/engine/env/registry';
import { EpisodeCoordinator } from './episodeCoordinator';
import type { EventSink } from './events';

/**
 * The coordinator owns NEAT: selection, generations and checkpoints. It never
 * simulates anything itself; it sends work to the sim workers over ports the
 * main thread handed it.
 */
let sims: Comlink.Remote<SimApi>[] = [];
/** The single population run this pool trains. Each lab has its own pool, so one is enough. */
let episodes: EpisodeCoordinator | null = null;
let emit: EventSink = () => {};

const api = {
  connect(simPorts: MessagePort[], sink: EventSink) {
    sims = simPorts.map((p) => Comlink.wrap<SimApi>(p));
    emit = sink;
  },
  /** Opens a run of any registered episode env, from a checkpoint when there is one. */
  async load(config: RunConfig, state?: EpisodeTrainerState) {
    await episodes?.stop();
    episodes = null;
    await loadEpisodeModule(config.env);
    episodes = new EpisodeCoordinator(config, sims, (e) => emit(e), state);
    return episodes.generation;
  },
  start(generations?: number) {
    episodes?.start(generations);
  },
  pause() {
    episodes?.pause();
  },
  setSpeed(mode: SpeedMode) {
    episodes?.setSpeed(mode);
  },
  checkpoint() {
    return episodes?.checkpoint() ?? null;
  },
  async unload() {
    await episodes?.stop();
    episodes = null;
  },
};

export type CoordinatorApi = typeof api;
Comlink.expose(api);
