/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { Genome } from '@/engine/neat/types';
import type { RacingSetup } from '@/engine/training/racingSetup';
import { StreamSender } from '../shared/streamPort';
import { RacingSim, type LiveRacingRequest } from './racingSim';

/**
 * A simulation worker. The main thread hands it two ports: one the
 * coordinator uses to send work, and one for streaming snapshots straight to
 * the renderer.
 */
const racing = new RacingSim();
let stream: StreamSender | null = null;

const api = {
  evaluateRacing(setup: RacingSetup, genomes: Genome[], seeds: number[], generation: number) {
    return racing.evaluate(setup, genomes, seeds, generation);
  },
  runRacingLive(req: LiveRacingRequest) {
    if (!stream) throw new Error('Stream port not connected');
    return racing.runLive(req, stream);
  },
  setSpeed(speed: number) {
    racing.setSpeed(speed);
  },
  setPaused(paused: boolean) {
    racing.setPaused(paused);
  },
  stopLive() {
    racing.stopLive();
  },
};

export type SimApi = typeof api;

Comlink.expose({
  connect(coordinatorPort: MessagePort, streamPort: MessagePort) {
    stream = new StreamSender(streamPort, 'population');
    Comlink.expose(api, coordinatorPort);
  },
});
