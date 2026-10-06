/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import type { RacingSetup } from '@/engine/training/racingSetup';
import type { RunConfig } from '@/engine/training/runConfig';
import { loadReferences, runBenchmark, type BenchModel, type BenchReferences } from '@/engine/bench';
import type { RoundReplay } from '@/engine/training/hideseekRecords';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import { ArenaFrameWriter } from '../shared/arenaFrames';
import { HideSeekHostCache } from '../shared/hideSeekHost';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';
import { RoundPlayer } from './roundPlayer';
import { SandboxPlayer, type SandboxScene } from './sandboxPlayer';

/**
 * The replay worker re-simulates stored genomes: ghosts for overlay
 * generations, round replays and the Sandbox. It is separate from training so
 * watching never slows training down.
 */
let ghosts: GhostPlayer | null = null;
let round: RoundPlayer | null = null;
let sandbox: SandboxPlayer | null = null;
let pool: Promise<ArenaPool> | null = null;
/** One Rapier load and pool for the worker, shared by round replays, the Sandbox and benchmarks. */
const arenas = () => (pool ??= createArenaPool());
let hsReferences: BenchReferences | null = null;
/** The Hide and Seek reference champions, fetched once. A failed fetch is tried again next time. */
const hideSeekReferences = async () => (hsReferences ??= await loadReferences('hideseek'));

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
  /**
   * Scores a Racing champion, or a Hide and Seek champion pair, on the
   * benchmark at low priority: the exam pauses after every episode or game,
   * so ghost frames and round replays keep playing in between.
   */
  async benchmark(config: RunConfig, model: BenchModel) {
    const opts = config.env === 'hideseek' ? { pool: await arenas(), references: await hideSeekReferences() } : {};
    const result = await runBenchmark(config, model, opts);
    return result ? { score: result.score, radar: result.radar } : null;
  },
  /** Hide and Seek: the round replay and the Sandbox share one arena stream, so starting one stops the other. */
  connectArenas(streamPort: MessagePort) {
    const stream = new StreamSender(streamPort, 'arenas');
    const hosts = new HideSeekHostCache();
    round = new RoundPlayer(new ArenaFrameWriter(stream), arenas, hosts);
    sandbox = new SandboxPlayer(stream, arenas, hosts);
  },
  playRound(replay: RoundReplay, speed: number, loop: boolean) {
    sandbox?.stop();
    return round?.play(replay, speed, loop);
  },
  setRoundSpeed(speed: number) {
    round?.setSpeed(speed);
  },
  setRoundPaused(paused: boolean) {
    round?.setPaused(paused);
  },
  stopRound() {
    round?.stop();
  },
  loadSandbox(scene: SandboxScene) {
    round?.stop();
    return sandbox?.load(scene);
  },
  setSandboxPaused(paused: boolean) {
    sandbox?.setPaused(paused);
  },
  setSandboxSpeed(speed: number) {
    sandbox?.setSpeed(speed);
  },
  restartSandbox() {
    return sandbox?.restart();
  },
  sandboxMoveBox(index: number, x: number, z: number) {
    sandbox?.moveBox(index, x, z);
  },
  sandboxSetBoxLocked(index: number, locked: boolean) {
    sandbox?.setBoxLocked(index, locked);
  },
  sandboxLesion(agent: number, index: number, value: number | null) {
    sandbox?.setLesion(agent, index, value);
  },
  sandboxClearLesions() {
    sandbox?.clearLesions();
  },
  stopSandbox() {
    sandbox?.stop();
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
