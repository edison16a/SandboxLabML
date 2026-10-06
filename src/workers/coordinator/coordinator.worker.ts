/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { RunConfig } from '@/engine/training/runConfig';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import type { EventSink } from './events';
import { HideSeekCoordinator } from './hideSeekCoordinator';
import type { HideSeekEventSink } from './hideSeekEvents';
import { RacingCoordinator } from './racingCoordinator';

/**
 * The coordinator owns NEAT: selection, generations and checkpoints. It never
 * simulates anything itself; it sends work to the sim workers over ports the
 * main thread handed it.
 */
let sims: Comlink.Remote<SimApi>[] = [];
let racing: RacingCoordinator | null = null;
let emit: EventSink = () => {};
let hideseek: HideSeekCoordinator | null = null;
let emitHideSeek: HideSeekEventSink = () => {};

const api = {
  connect(simPorts: MessagePort[], sink: EventSink) {
    sims = simPorts.map((p) => Comlink.wrap<SimApi>(p));
    emit = sink;
  },
  async loadRacing(config: RunConfig, state?: RacingTrainerState) {
    await racing?.stop();
    racing = new RacingCoordinator(config, sims, (e) => emit(e), state);
    return racing.generation;
  },
  start(generations?: number) {
    racing?.start(generations);
  },
  pause() {
    racing?.pause();
  },
  setSpeed(mode: SpeedMode) {
    racing?.setSpeed(mode);
  },
  checkpoint() {
    return racing?.checkpoint() ?? null;
  },
  async unload() {
    await racing?.stop();
    racing = null;
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
