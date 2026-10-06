import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { hideSeekPhysics } from '@/engine/hideseek/physics';
import { runMatch } from '@/engine/hideseek/match/runMatch';
import { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import { buildRoundReplay, type HideSeekRecord } from '@/engine/training/hideseekRecords';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { hideSeekTrainerOptions } from '@/engine/training/hideseekSetup';
import { latestCheckpoint, saveCheckpoint } from './checkpoints';
import { SandboxDb, setDb } from './db';
import { listHideSeekGenerationNumbers } from './generationIndex';
import { deleteHideSeekGenerationsFrom, KEEP_REPLAYS, loadHideSeekChampions, loadHideSeekHistory, saveHideSeekGeneration, setHideSeekGenerationBenchmark } from './hideSeekGenerations';
import { createRun, getRun, listRuns, trashRun } from './runs';

let n = 0;
let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());
beforeEach(() => setDb(new SandboxDb(`hs-test-${n++}`)));

/** A tiny run with two second matches, trained for real and saved like the lab does. */
async function trained(generations: number) {
  const config = createHideSeekRunConfig({
    name: 'tiny',
    seed: 5,
    blueprint: HIDESEEK_BLUEPRINTS[0],
    populationPerTeam: 4,
    rounds: 2,
    physics: hideSeekPhysics({ matchSeconds: 2 }),
  });
  await createRun(config);
  const t = HideSeekTrainer.create(hideSeekTrainerOptions(config));
  const records: HideSeekRecord[] = [];
  for (let g = 0; g < generations; g++) {
    const plan = t.planGeneration();
    const replay = buildRoundReplay(plan[plan.length - 1], { generation: g, round: plan.length - 1, rounds: plan.length, scriptSource: null });
    const stats = t.completeGeneration(plan.map((round) => round.map((s) => runMatch(s, pool))));
    const fame = { h: t.hallOfFame.hiders.toState(), s: t.hallOfFame.seekers.toState() };
    const record: HideSeekRecord = { runId: config.id, generation: g, stats, hiderChampion: fame.h[fame.h.length - 1].genome, seekerChampion: fame.s[fame.s.length - 1].genome, replay, simSeconds: 1, wallMs: 1 };
    records.push(record);
    await saveHideSeekGeneration(record);
  }
  return { config, trainer: t, records };
}

describe('Hide and Seek generations', () => {
  it('round trips champions, stats and replays, and shows the run on the Runs list', async () => {
    const { config, records } = await trained(2);
    const history = await loadHideSeekHistory(config.id);
    expect(history.map((r) => r.generation)).toEqual([0, 1]);
    expect(history[1].hiderChampion.connections).toEqual(records[1].hiderChampion.connections);
    expect(history[1].stats.game.matches).toBe(records[1].stats.game.matches);
    expect(history[1].replay?.matches).toEqual(records[1].replay?.matches);
    const champs = await loadHideSeekChampions(config.id, 0);
    expect(champs?.seeker.connections).toEqual(records[0].seekerChampion.connections);
    const runs = await listRuns();
    expect(runs.find((r) => r.id === config.id)?.env).toBe('hideseek');
    expect((await getRun(config.id))?.generation).toBe(2);
  });

  it('stores a benchmark score on a generation and lists generation numbers', async () => {
    const { config } = await trained(2);
    expect((await loadHideSeekHistory(config.id)).some((r) => r.benchmark !== undefined)).toBe(false);
    await setHideSeekGenerationBenchmark(config.id, 0, 42.5);
    await setHideSeekGenerationBenchmark(config.id, 9, 99);
    const history = await loadHideSeekHistory(config.id);
    expect(history.map((r) => r.benchmark)).toEqual([42.5, undefined]);
    expect(await listHideSeekGenerationNumbers(config.id)).toEqual([0, 1]);
  });

  it('keeps replays only on the newest generations', async () => {
    const { config } = await trained(KEEP_REPLAYS + 2);
    const history = await loadHideSeekHistory(config.id);
    expect(history.filter((r) => r.replay).map((r) => r.generation)).toEqual([2, 3, 4]);
  });

  it('resumes from a checkpoint and trashes like any run', async () => {
    const { config } = await trained(4);
    // A checkpoint taken after three generations, then a fourth finished before the tab closed.
    const twin = await trained(3);
    await saveCheckpoint(config.id, 3, twin.trainer.toState());
    await deleteHideSeekGenerationsFrom(config.id, 3);
    expect((await loadHideSeekHistory(config.id)).map((r) => r.generation)).toEqual([0, 1, 2]);
    const cp = await latestCheckpoint(config.id);
    const resumed = HideSeekTrainer.fromState(cp!.state as ReturnType<HideSeekTrainer['toState']>);
    expect(resumed.generation).toBe(3);
    expect(resumed.planGeneration()[0].map((s) => s.seed)).toEqual(twin.trainer.planGeneration()[0].map((s) => s.seed));
    await trashRun(config.id);
    expect((await listRuns()).some((r) => r.id === config.id)).toBe(false);
  });
});
