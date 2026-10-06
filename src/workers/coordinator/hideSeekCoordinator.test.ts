import type { Remote } from 'comlink';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { runMatch, startMatch } from '@/engine/hideseek/match/runMatch';
import { hideSeekPhysics } from '@/engine/hideseek/physics';
import { HIDESEEK_SNAPSHOT } from '@/engine/hideseek/snapshot';
import { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import type { HideSeekRecord } from '@/engine/training/hideseekRecords';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { hideSeekTrainerOptions } from '@/engine/training/hideseekSetup';
import { ArenaStream } from '../client/arenaStream';
import { ArenaFrameWriter } from '../shared/arenaFrames';
import { StreamSender } from '../shared/streamPort';
import type { SimApi } from '../sim/sim.worker';
import { HideSeekSim } from '../sim/hideSeekSim';
import type { HideSeekEvent } from './hideSeekEvents';
import { HideSeekCoordinator } from './hideSeekCoordinator';

const STRIDE = HIDESEEK_SNAPSHOT.stride;

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** Two in-process sims standing in for workers, each streaming its arenas over a real MessageChannel. */
function fakeSims(count: number) {
  const mainPorts: MessagePort[] = [];
  const sims = Array.from({ length: count }, () => {
    const channel = new MessageChannel();
    mainPorts.push(channel.port1);
    const sim = new HideSeekSim(new ArenaFrameWriter(new StreamSender(channel.port2, 'arenas')));
    return {
      evaluateHideSeek: (specs: Parameters<HideSeekSim['evaluate']>[0], script: string | null) => sim.evaluate(specs, script),
      loadHideSeekLive: (req: Parameters<HideSeekSim['loadLive']>[0]) => sim.loadLive(req),
      stepHideSeekLive: async (n: number) => sim.stepLive(n),
      finishHideSeekLive: async () => sim.finishLive(),
      stopHideSeekLive: async () => sim.stopLive(),
    } as unknown as Remote<SimApi>;
  });
  return { sims, stream: new ArenaStream('arenas', mainPorts), close: () => mainPorts.forEach((p) => p.close()) };
}

const config = createHideSeekRunConfig({
  name: 'c',
  seed: 77,
  blueprint: HIDESEEK_BLUEPRINTS[0],
  populationPerTeam: 5,
  rounds: 2,
  layouts: ['shelter'],
  physics: hideSeekPhysics({ matchSeconds: 2 }),
});

describe('Hide and Seek coordinator', () => {
  it('plays a generation live across workers and scores it exactly like a headless run', async () => {
    const { sims, stream, close } = fakeSims(2);
    const events: HideSeekEvent[] = [];
    const record = new Promise<HideSeekRecord>((resolve) => {
      const coordinator = new HideSeekCoordinator(config, sims, (e) => {
        events.push(e);
        if (e.type === 'generation') resolve(e.record);
      });
      coordinator.setSpeed('4x');
      coordinator.start(1);
    });
    let ends = 0;
    stream.on((msg) => void (msg.kind === 'end' && ends++));
    const live = await record;
    // Frames cross a real message channel, so wait until both workers have sent the end of both rounds.
    while (ends < 4) await new Promise((r) => setTimeout(r, 10));
    const lastFrame = stream.curr?.buffer.slice();
    close();

    const headless = HideSeekTrainer.create(hideSeekTrainerOptions(config));
    const plan = headless.planGeneration();
    const stats = headless.completeGeneration(plan.map((round) => round.map((s) => runMatch(s, pool))));
    expect(live.stats).toEqual(stats);
    expect(events.filter((e) => e.type === 'round').map((e) => (e.type === 'round' ? e.live : null))).toEqual([true, true]);

    // The merged stream holds every arena of the last live round in match order.
    const last = plan[plan.length - 1];
    expect(stream.count).toBe(last.length);
    const finals = last.map((spec) => {
      const m = startMatch(spec, pool);
      while (!m.done) m.step();
      const out = new Float32Array(STRIDE);
      m.snapshot(out);
      m.release();
      return Array.from(out);
    });
    finals.forEach((f, i) => expect(Array.from(lastFrame!.subarray(i * STRIDE, (i + 1) * STRIDE))).toEqual(f));
  });

  it('runs Turbo rounds headless and keeps finished rounds when paused between them', async () => {
    const { sims, close } = fakeSims(3);
    const records: HideSeekRecord[] = [];
    const coordinator = new HideSeekCoordinator(config, sims, (e) => {
      if (e.type === 'generation') records.push(e.record);
    });
    coordinator.setSpeed('turbo');
    coordinator.start(2);
    while (records.length < 2) await new Promise((r) => setTimeout(r, 20));
    await coordinator.stop();
    close();
    const t = HideSeekTrainer.create(hideSeekTrainerOptions(config));
    for (const record of records) {
      const plan = t.planGeneration();
      expect(record.stats).toEqual(t.completeGeneration(plan.map((round) => round.map((s) => runMatch(s, pool)))));
      expect(record.replay?.matches).toHaveLength(plan[plan.length - 1].length);
    }
  });
});
