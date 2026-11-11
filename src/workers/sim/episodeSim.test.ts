import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerEpisodeModule } from '@/engine/env/registry';
import { Network } from '@/engine/neat/network';
import { TOY_BLUEPRINT, TOY_ENV, toyModule } from '@/engine/env/tests/toyEnv';
import { EpisodeTrainer } from '@/engine/training/episodeTrainer';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { GhostPlayer } from '../replay/ghostPlayer';
import type { StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { EpisodeSim } from './episodeSim';

let unregister: () => void;
beforeAll(() => {
  unregister = registerEpisodeModule(toyModule);
});
afterAll(() => unregister());

/** A stream whose messages are kept and whose buffers go straight back, like the main thread does. */
function capture(name: 'population' | 'ghosts') {
  const messages: StreamOut[] = [];
  const port = {
    onmessage: null as unknown,
    postMessage(msg: StreamOut) {
      if (msg.kind === 'frame') {
        messages.push({ ...msg, buffer: msg.buffer.slice() });
        sender.ring.give(msg.buffer.buffer as ArrayBuffer);
      } else messages.push(msg);
    },
  };
  const sender = new StreamSender(port as unknown as MessagePort, name);
  return { sender, messages };
}

function trainer() {
  const config = createEpisodeRunConfig({ env: TOY_ENV, name: 'toy', seed: 5, blueprint: TOY_BLUEPRINT, populationSize: 12, settings: { maxTime: 4 } });
  return new EpisodeTrainer(toyModule, config);
}

describe('episode sim with a toy env', () => {
  it('gives the same results split into batches as in one', () => {
    const t = trainer();
    const sim = new EpisodeSim();
    const whole = sim.evaluate(TOY_ENV, t.setup(), t.genomes, t.seeds(), 0);
    const halves = [...sim.evaluate(TOY_ENV, t.setup(), t.genomes.slice(0, 6), t.seeds().slice(0, 6), 0), ...sim.evaluate(TOY_ENV, t.setup(), t.genomes.slice(6), t.seeds().slice(6), 0)];
    expect(halves).toEqual(whole);
  });

  it('streams the live run with the world block after the agents', async () => {
    const t = trainer();
    const { sender, messages } = capture('population');
    sender.inspect = -1;
    const results = await new EpisodeSim().runLive({ env: TOY_ENV, setup: t.setup(), genomes: t.genomes, seeds: t.seeds(), generation: 0, speed: Infinity, tags: t.genomes.map(() => 0) }, sender);
    expect(results).toEqual(new EpisodeSim().evaluate(TOY_ENV, t.setup(), t.genomes, t.seeds(), 0));
    const start = messages[0];
    expect(start).toMatchObject({ kind: 'start', count: 12, world: 2 });
    const frame = messages.find((m) => m.kind === 'frame');
    if (frame?.kind !== 'frame') throw new Error('No frame');
    expect(frame.buffer.length).toBe(12 * 2 + 2);
    // The world block ends with the tick the env wrote it on.
    expect(frame.buffer[12 * 2 + 1]).toBe(frame.tick);
    expect(frame.inspect?.obs).toHaveLength(2);
    expect(frame.inspect?.out).toHaveLength(1);
  });

  it('settles a stopped live run with no results', async () => {
    const t = trainer();
    const sim = new EpisodeSim();
    const live = sim.runLive({ env: TOY_ENV, setup: t.setup(), genomes: t.genomes, seeds: t.seeds(), generation: 0, speed: 1, tags: [] }, capture('population').sender);
    sim.stopLive();
    expect(await live).toEqual([]);
  });

  it('replays a champion as a ghost tick for tick, with the shared world', () => {
    const t = trainer();
    const champion = t.genomes[3];
    const seed = t.seeds()[3];
    const player = new GhostPlayer(capture('ghosts').sender);
    player.setScene(TOY_ENV, t.setup(), [{ generation: 0, genome: champion, seed, scriptSource: null }]);
    const [line] = player.telemetry();
    // Replayed alone, the champion walks exactly as it did among the whole population.
    const env = toyModule.createEnv(t.setup(), t.host(), 0);
    env.reset(
      t.genomes.map((g) => new Network(g)),
      t.seeds(),
    );
    const xs: number[] = [];
    const snap = new Float32Array(t.genomes.length * 2);
    while (!env.done) {
      env.step();
      env.writeSnapshot(snap);
      if (xs.length < line.distance.length) xs.push(snap[3 * 2]);
    }
    expect(Array.from(line.distance)).toEqual(xs);
  });
});
