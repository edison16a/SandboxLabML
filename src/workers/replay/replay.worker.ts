/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { RacingSetup } from '@/engine/training/racingSetup';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

/**
 * The replay worker re-simulates stored genomes: ghosts for overlay
 * generations, round replays and the Sandbox. It is separate from training so
 * watching never slows training down.
 */
let ghosts: GhostPlayer | null = null;

const api = {
  connect(streamPort: MessagePort) {
    ghosts = new GhostPlayer(new StreamSender(streamPort, 'ghosts'));
  },
  setGhostScene(setup: RacingSetup, specs: GhostSpec[]) {
    ghosts?.setScene(setup, specs);
  },
  playGhosts(speed: number, loop: boolean) {
    ghosts?.play(speed, loop);
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
  ghostTelemetry() {
    const t = ghosts?.telemetry() ?? [];
    return Comlink.transfer(
      t,
      t.flatMap((g) => [g.distance.buffer as ArrayBuffer, g.speed.buffer as ArrayBuffer]),
    );
  },
};

export type ReplayApi = typeof api;
Comlink.expose(api);
