import { afterEach, describe, expect, it, vi } from 'vitest';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { RacingTrainer } from '@/engine/training/racingTrainer';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import type { StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

const STRIDE = RACING_SNAPSHOT.stride;

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

function scene() {
  const config = createRacingRunConfig({ name: 'g', seed: 5, blueprint: RACING_BLUEPRINTS[2], track: BUILT_IN_TRACKS[0], carPreset: 'standard', populationSize: 10 });
  const trainer = new RacingTrainer(config);
  const ghost = (generation: number, slot: number): GhostSpec => ({ generation, genome: trainer.genomes[generation], seed: 40 + generation, scriptSource: null, slot });
  return { setup: trainer.setup(), ghost };
}

describe('ghost player grid', () => {
  it('draws one telemetry line per car, in stream order, with its grid slot', () => {
    const { setup, ghost } = scene();
    const field = new GhostPlayer(capture().sender);
    field.setScene(setup, [ghost(1, 3), ghost(2, 2), ghost(2, 1), ghost(2, 0)]);
    const lone = new GhostPlayer(capture().sender);
    lone.setScene(setup, [ghost(2, 0)]);
    const lines = field.telemetry();
    expect(lines.map((t) => [t.generation, t.slot])).toEqual([[1, 3], [2, 2], [2, 1], [2, 0]]);
    // The pole car drives exactly the lap it would drive alone, and back slots start behind the line.
    expect(Array.from(lines[3].distance)).toEqual(Array.from(lone.telemetry()[0].distance));
    expect(lines[0].distance[0]).toBeLessThan(-10);
    // A crash carries the meters the car drove from its own slot, which is what the crash label shows.
    const crashed = lines.filter((t) => t.crash);
    expect(crashed.length).toBeGreaterThan(0);
    for (const t of crashed) expect(t.crash?.driven).toBeCloseTo(Math.max(0, t.distance[t.distance.length - 1] - t.distance[0]), 4);
  });

  it('starts copies of one champion on separate grid slots', async () => {
    const { setup, ghost } = scene();
    const { sender, frames } = capture();
    const player = new GhostPlayer(sender);
    player.setScene(setup, [ghost(3, 2), ghost(3, 1), ghost(3, 0)]);
    player.play(1, false);
    // The first frame waits for a timer slice; poll rather than guess how long a busy machine takes.
    for (let waited = 0; frames.length === 0 && waited < 5000; waited += 20) await new Promise((r) => setTimeout(r, 20));
    player.stop();
    const first = frames[0];
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        const d = Math.hypot(first[a * STRIDE] - first[b * STRIDE], first[a * STRIDE + 1] - first[b * STRIDE + 1]);
        expect(d).toBeGreaterThan(4.5);
      }
    }
  });
});

describe('ghost player warm up', () => {
  it('opens part way into the lap on the very tick a cold start reaches', async () => {
    const { setup, ghost } = scene();
    const { sender, frames, ticks } = capture();
    const player = new GhostPlayer(sender);
    player.setScene(setup, [ghost(2, 0)]);
    const lap = player.telemetry()[0];
    const warmup = Math.min(40, lap.distance.length - 1);
    player.play(1, false, warmup);
    for (let waited = 0; frames.length === 0 && waited < 5000; waited += 20) await new Promise((r) => setTimeout(r, 20));
    player.stop();
    expect(ticks[0]).toBeGreaterThanOrEqual(warmup);
    // Telemetry index k is the car after tick k + 1, and progress is the last field of a snapshot.
    expect(frames[0][STRIDE - 1]).toBeCloseTo(lap.distance[ticks[0] - 1], 4);
  });
});

describe('ghost player loop', () => {
  afterEach(() => vi.useRealTimers());

  /** One ghost that loops. Its first run goes flat out, so it ends within a few fake milliseconds and the 1200 ms gap starts. */
  function finishedFirstRun() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const { setup, ghost } = scene();
    const out = capture();
    const player = new GhostPlayer(out.sender);
    player.setScene(setup, [ghost(4, 0)]);
    player.play(Infinity, true);
    vi.advanceTimersByTime(100);
    expect(out.starts.count).toBe(1);
    expect(out.ticks.length).toBeGreaterThan(0);
    return { player, out, length: player.telemetry()[0].distance.length };
  }

  it('cancels a loop restart still waiting out the gap when the replay stops', () => {
    const { player, out } = finishedFirstRun();
    vi.advanceTimersByTime(500);
    player.stop();
    vi.advanceTimersByTime(5000);
    expect(out.starts.count).toBe(1);
  });

  it('keeps a pause and a new speed pressed during the gap', () => {
    const { player, out, length } = finishedFirstRun();
    vi.advanceTimersByTime(500);
    player.setPaused(true);
    player.setSpeed(2);
    vi.advanceTimersByTime(800);
    expect(out.starts.count).toBe(2);
    const framesBefore = out.ticks.length;
    vi.advanceTimersByTime(2000);
    expect(out.ticks.length).toBe(framesBefore);

    // Unpaused, it drives at the speed picked during the gap: about 15 ticks in a quarter second at 2x.
    expect(length).toBeGreaterThan(20);
    player.setPaused(false);
    vi.advanceTimersByTime(250);
    expect(out.ticks[out.ticks.length - 1]).toBeGreaterThanOrEqual(13);
    expect(out.ticks[out.ticks.length - 1]).toBeLessThanOrEqual(16);
    player.stop();
  });
});
