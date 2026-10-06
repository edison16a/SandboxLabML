/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { RunConfig } from '@/engine/training/runConfig';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import type { EventSink } from './events';
import { RacingCoordinator } from './racingCoordinator';

/**
 * The coordinator owns NEAT: selection, generations and checkpoints. It never
 * simulates anything itself; it sends work to the sim workers over ports the
 * main thread handed it.
 */
let sims: Comlink.Remote<SimApi>[] = [];
let racing: RacingCoordinator | null = null;
let emit: EventSink = () => {};

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
};

export type CoordinatorApi = typeof api;
Comlink.expose(api);
