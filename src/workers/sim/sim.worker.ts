/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { MatchSpec } from '@/engine/hideseek/match/types';
import type { Genome } from '@/engine/neat/types';
import type { RacingSetup } from '@/engine/training/racingSetup';
import { ArenaFrameWriter } from '../shared/arenaFrames';
import { StreamSender } from '../shared/streamPort';
import { HideSeekSim, type LiveRoundPart } from './hideSeekSim';
import { RacingSim, type LiveRacingRequest } from './racingSim';

/**
 * A simulation worker. The main thread hands it two ports: one the
 * coordinator uses to send work, and one for streaming snapshots straight to
 * the renderer.
 */
const racing = new RacingSim();
let stream: StreamSender | null = null;
let hideseek = new HideSeekSim(null);

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
  evaluateHideSeek(specs: MatchSpec[], scriptSource: string | null) {
    return hideseek.evaluate(specs, scriptSource);
  },
  loadHideSeekLive(req: LiveRoundPart) {
    return hideseek.loadLive(req);
  },
  stepHideSeekLive(ticks: number) {
    return hideseek.stepLive(ticks);
  },
  finishHideSeekLive() {
    return hideseek.finishLive();
  },
  stopHideSeekLive() {
    hideseek.stopLive();
  },
};

export type SimApi = typeof api;

Comlink.expose({
  /** `arenaPort` is optional so pools that never run Hide and Seek can leave it out. */
  connect(coordinatorPort: MessagePort, streamPort: MessagePort, arenaPort?: MessagePort) {
    stream = new StreamSender(streamPort, 'population');
    if (arenaPort) hideseek = new HideSeekSim(new ArenaFrameWriter(new StreamSender(arenaPort, 'arenas')));
    Comlink.expose(api, coordinatorPort);
  },
});
