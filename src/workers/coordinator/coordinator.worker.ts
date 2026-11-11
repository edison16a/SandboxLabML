/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { RunConfig } from '@/engine/training/runConfig';
import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import { loadEpisodeModule } from '@/engine/env/registry';
import { EpisodeCoordinator } from './episodeCoordinator';
import type { EventSink } from './events';
import { HideSeekCoordinator } from './hideSeekCoordinator';
import type { HideSeekEventSink } from './hideSeekEvents';

/**
 * The coordinator owns NEAT: selection, generations and checkpoints. It never
 * simulates anything itself; it sends work to the sim workers over ports the
 * main thread handed it.
 */
let sims: Comlink.Remote<SimApi>[] = [];
/** The single population run this pool trains. Each lab has its own pool, so one is enough. */
let episodes: EpisodeCoordinator | null = null;
let emit: EventSink = () => {};
let hideseek: HideSeekCoordinator | null = null;
let emitHideSeek: HideSeekEventSink = () => {};

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
  /** Hide and Seek has its own event sink, so its messages never reach the Racing lab. */
  connectHideSeek(sink: HideSeekEventSink) {
    emitHideSeek = sink;
  },
  async loadHideSeek(config: RunConfig, state?: HideSeekTrainerState) {
    await hideseek?.stop();
    hideseek = new HideSeekCoordinator(config, sims, (e) => emitHideSeek(e), state);
    return hideseek.generation;
  },
  startHideSeek(generations?: number) {
    hideseek?.start(generations);
  },
  pauseHideSeek() {
    hideseek?.pause();
  },
  setHideSeekSpeed(mode: SpeedMode) {
    hideseek?.setSpeed(mode);
  },
  checkpointHideSeek() {
    return hideseek?.checkpoint() ?? null;
  },
  async unloadHideSeek() {
    await hideseek?.stop();
    hideseek = null;
  },
};

export type CoordinatorApi = typeof api;
Comlink.expose(api);
