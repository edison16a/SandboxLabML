import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { TOY_BLUEPRINT, TOY_ENV, toyModule } from '@/engine/env/tests/toyEnv';
import { EpisodeTrainer } from '@/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { builtinHost, registerScriptHostFactory } from '@/engine/training/scriptHost';
import { EpisodeSim } from '../sim/episodeSim';
import type { StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
  // Any source gets the built in reward: the test only needs two script groups, not a real script.
  registerScriptHostFactory(() => builtinHost);
});
afterAll(() => unregister());

/** Frames copied out as they arrive, with their buffers handed straight back. */
function capture() {
  const frames: Array<{ tick: number; buffer: Float32Array }> = [];
  const port = {
    onmessage: null as unknown,
    postMessage(msg: StreamOut) {
      if (msg.kind !== 'frame') return;
      frames.push({ tick: msg.tick, buffer: msg.buffer.slice() });
      sender.ring.give(msg.buffer.buffer as ArrayBuffer);
    },
  };
  const sender = new StreamSender(port as unknown as MessagePort, 'ghosts');
  return { sender, frames };
}

describe('ghost frames', () => {
  it('keeps the shared world moving after the first script group is done', async () => {
    const config = createEpisodeRunConfig({ env: TOY_ENV, name: 'toy', seed: 5, blueprint: TOY_BLUEPRINT, populationSize: 16, settings: { maxTime: 4 } });
    const t = new EpisodeTrainer(toyModule, config);
    const results = await new EpisodeSim().evaluate(TOY_ENV, t.setup(), t.genomes, t.seeds(), 0);
    const fast = results.findIndex((r) => r.stopReason === 'reached');
    const slow = results.findIndex((r) => r.stopReason === 'time');
    expect(fast).toBeGreaterThanOrEqual(0);
    expect(slow).toBeGreaterThanOrEqual(0);
    // The ghost that finishes first sits in the first group, so a world read from groups[0] would freeze.
    const ghost = (i: number, scriptSource: string | null): GhostSpec => ({ generation: i, genome: t.genomes[i], seed: t.seeds()[i], scriptSource });
    const { sender, frames } = capture();
    const player = new GhostPlayer(sender);
    await player.setScene(TOY_ENV, t.setup(), [ghost(fast, null), ghost(slow, 'script "x" for toy v1')]);
    player.play(Infinity, false);
    for (let waited = 0; frames.at(-1)?.tick !== 120 && waited < 5000; waited += 20) await new Promise((r) => setTimeout(r, 20));
    player.stop();
    const last = frames.at(-1);
    expect(last?.tick).toBe(120);
    // The world block starts after both ghosts and ends with the tick it was written on.
    expect(last?.buffer[2 * 2 + 1]).toBe(120);
    expect(last?.buffer[2 * 2]).toBeCloseTo(Math.sin(4), 5);
  });
});
