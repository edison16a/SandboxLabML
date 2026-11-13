import { afterEach, describe, expect, it, vi } from 'vitest';
import { mixSeed } from '@/engine/core/rng';
import { loadEpisodeModule } from '@/engine/env/registry';
import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { NAVIGATION_SNAPSHOT, SNAP_X, SNAP_Z } from '@/engine/navigation/snapshot';
import { Network } from '@/engine/neat/network';
import { EpisodeTrainer } from '@/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { builtinHost } from '@/engine/training/scriptHost';
import type { StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

const STRIDE = NAVIGATION_SNAPSHOT.stride;

/** A stream whose frames are copied out and whose buffers go straight back, like the main thread does. */
function capture() {
  const frames: Float32Array[] = [];
  const ticks: number[] = [];
  const starts = { count: 0 };
  const port = {
    onmessage: null as unknown,
    postMessage(msg: StreamOut) {
      if (msg.kind === 'start') starts.count++;
      if (msg.kind !== 'frame') return;
      frames.push(msg.buffer.slice());
      ticks.push(msg.tick);
      sender.ring.give(msg.buffer.buffer as ArrayBuffer);
    },
  };
  const sender = new StreamSender(port as unknown as MessagePort, 'ghosts');
  return { sender, frames, ticks, starts };
}

/** Champions of a fresh Navigation run on its first course, each ghost on the start slot asked for. */
async function scene() {
  const config = createEpisodeRunConfig({ env: 'navigation', name: 'g', seed: 5, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize: 10, settings: { ...navigationSettings() } });
  const trainer = new EpisodeTrainer(await loadEpisodeModule('navigation'), config);
  const ghost = (generation: number, slot: number): GhostSpec => ({ generation, genome: trainer.genomes[generation], seed: 40 + generation, scriptSource: null, slot });
  return { setup: trainer.setup(), ghost };
}

/** Plays until the first frames arrive. The first frame waits for a timer slice; poll rather than guess how long a busy machine takes. */
async function firstFrames(player: GhostPlayer, frames: Float32Array[], warmup = 0) {
  player.play(1, false, warmup);
  for (let waited = 0; frames.length === 0 && waited < 5000; waited += 20) await new Promise((r) => setTimeout(r, 20));
  player.stop();
}

describe('ghost player grid', () => {
  it('starts copies of one champion on separate start slots', async () => {
    const { setup, ghost } = await scene();
    const { sender, frames } = capture();
    const player = new GhostPlayer(sender);
    await player.setScene('navigation', setup, [ghost(3, 2), ghost(3, 1), ghost(3, 0)]);
    await firstFrames(player, frames);
    const first = frames[0];
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        const d = Math.hypot(first[a * STRIDE + SNAP_X] - first[b * STRIDE + SNAP_X], first[a * STRIDE + SNAP_Z] - first[b * STRIDE + SNAP_Z]);
        expect(d).toBeGreaterThan(0.5);
      }
    }
  });

  it('runs a ghost in a crowd exactly as it runs alone', async () => {
    const { setup, ghost } = await scene();
    const crowd = capture();
    const field = new GhostPlayer(crowd.sender);
    await field.setScene('navigation', setup, [ghost(1, 3), ghost(2, 2), ghost(2, 0)]);
    await firstFrames(field, crowd.frames, 60);
    const lone = capture();
    const alone = new GhostPlayer(lone.sender);
    await alone.setScene('navigation', setup, [ghost(2, 0)]);
    await firstFrames(alone, lone.frames, 60);
    expect(crowd.ticks[0]).toBe(lone.ticks[0]);
    expect(Array.from(crowd.frames[0].subarray(2 * STRIDE, 3 * STRIDE))).toEqual(Array.from(lone.frames[0].subarray(0, STRIDE)));
  });
});

describe('ghost player warm up', () => {
  it('opens part way into the run on the very tick a cold start reaches', async () => {
    const { setup, ghost } = await scene();
    const warm = capture();
    const player = new GhostPlayer(warm.sender);
    await player.setScene('navigation', setup, [ghost(2, 0)]);
    await firstFrames(player, warm.frames, 40);
    expect(warm.ticks[0]).toBeGreaterThanOrEqual(40);
    // The same ghost run cold, headless, the way the player builds it: no script and the ghost controller seed.
    const env = (await loadEpisodeModule('navigation')).createEnv({ ...setup, scriptSource: null }, builtinHost, mixSeed(0x9405));
    const g = ghost(2, 0);
    env.reset([new Network(g.genome)], [g.seed], [0]);
    while (env.tick < warm.ticks[0]) env.step();
    const cold = new Float32Array(STRIDE);
    env.writeSnapshot(cold);
    expect(Array.from(warm.frames[0].subarray(0, STRIDE))).toEqual(Array.from(cold));
  });
});

describe('ghost player loop', () => {
  afterEach(() => vi.useRealTimers());

  /** One ghost that loops. Its first run goes flat out, so it ends within a few fake milliseconds and the gap (1200 ms unless given) starts. */
  async function finishedFirstRun(gap?: number) {
    const { setup, ghost } = await scene();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const out = capture();
    const player = new GhostPlayer(out.sender);
    await player.setScene('navigation', setup, [ghost(4, 0)]);
    player.play(Infinity, true, 0, gap);
    vi.advanceTimersByTime(100);
    expect(out.starts.count).toBe(1);
    expect(out.ticks.length).toBeGreaterThan(0);
    return { player, out, length: out.ticks.at(-1)! };
  }

  it('cancels a loop restart still waiting out the gap when the replay stops', async () => {
    const { player, out } = await finishedFirstRun();
    vi.advanceTimersByTime(500);
    player.stop();
    vi.advanceTimersByTime(5000);
    expect(out.starts.count).toBe(1);
  });

  it('rests on the last frame for the gap it was given, every loop', async () => {
    const { player, out } = await finishedFirstRun(4000);
    vi.advanceTimersByTime(3500);
    expect(out.starts.count).toBe(1);
    vi.advanceTimersByTime(600);
    expect(out.starts.count).toBe(2);
    // The second run ends flat out too, and waits the same 4 s again.
    vi.advanceTimersByTime(3500);
    expect(out.starts.count).toBe(2);
    vi.advanceTimersByTime(600);
    expect(out.starts.count).toBe(3);
    player.stop();
  });

  it('holds a pause pressed during the gap on the finished run, then starts over at the new speed', async () => {
    const { player, out, length } = await finishedFirstRun();
    vi.advanceTimersByTime(500);
    player.setPaused(true);
    player.setSpeed(2);
    // The gap ends while paused: no new run starts, so the finished run stays on screen.
    vi.advanceTimersByTime(800);
    vi.advanceTimersByTime(2000);
    expect(out.starts.count).toBe(1);
    expect(out.ticks.at(-1)).toBe(length);

    // Resumed, the next run starts at once, opens on its lineup and runs at the speed picked during the gap: about 15 ticks in a quarter second at 2x.
    expect(length).toBeGreaterThan(20);
    player.setPaused(false);
    expect(out.starts.count).toBe(2);
    expect(out.ticks.at(-1)).toBe(0);
    vi.advanceTimersByTime(250);
    expect(out.ticks[out.ticks.length - 1]).toBeGreaterThanOrEqual(13);
    expect(out.ticks[out.ticks.length - 1]).toBeLessThanOrEqual(16);
    player.stop();
  });

  it('drops a restart held by a pause when the replay stops', async () => {
    const { player, out } = await finishedFirstRun();
    player.setPaused(true);
    vi.advanceTimersByTime(2000);
    player.stop();
    player.setPaused(false);
    vi.advanceTimersByTime(2000);
    expect(out.starts.count).toBe(1);
  });

  it('opens every run on its lineup frame, even one started paused with every buffer out', async () => {
    const { setup, ghost } = await scene();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const out = capture();
    const player = new GhostPlayer(out.sender);
    await player.setScene('navigation', setup, [ghost(4, 0), ghost(2, 1)]);
    // A first run sizes the buffers. Then the main thread holds them all, as it can right after a run starts.
    player.play(1, true);
    player.stop();
    const held: Float32Array[] = [];
    for (let b = out.sender.ring.take(); b; b = out.sender.ring.take()) held.push(b);
    expect(held.length).toBeGreaterThan(0);
    const before = out.ticks.length;
    player.play(1, true);
    player.setPaused(true);
    vi.advanceTimersByTime(2000);
    expect(out.starts.count).toBe(2);
    expect(out.ticks.slice(before)).toEqual([0]);
    expect(out.frames.at(-1)?.length).toBe(held[0].length);
    player.stop();
  });
});
