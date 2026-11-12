/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { EpisodeSetup } from '@/engine/env/episode';
import type { Genome } from '@/engine/neat/types';
import { StreamSender } from '../shared/streamPort';
import { EpisodeSim, type LiveEpisodeRequest } from './episodeSim';

/**
 * A simulation worker. The main thread hands it two ports: one the
 * coordinator uses to send work, and one for streaming snapshots straight to
 * the renderer.
 */
const episodes = new EpisodeSim();
let stream: StreamSender | null = null;

const api = {
  /** A headless batch of any single population env, as fast as it runs. */
  evaluate(env: string, setup: EpisodeSetup, genomes: Genome[], seeds: number[], generation: number, slots?: number[]) {
    return episodes.evaluate(env, setup, genomes, seeds, generation, slots);
  },
  /** A whole generation paced to real time, streamed to the main thread. */
  runLive(req: LiveEpisodeRequest) {
    if (!stream) throw new Error('Stream port not connected');
    return episodes.runLive(req, stream);
  },
  setSpeed(speed: number) {
    episodes.setSpeed(speed);
  },
  setPaused(paused: boolean) {
    episodes.setPaused(paused);
  },
  stopLive() {
    episodes.stopLive();
  },
};

export type SimApi = typeof api;

Comlink.expose({
  connect(coordinatorPort: MessagePort, streamPort: MessagePort) {
    stream = new StreamSender(streamPort, 'population');
    Comlink.expose(api, coordinatorPort);
  },
});
