import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '../blueprints/presets';
import { blueprintInputCount } from '../blueprints/shape';
import { HIDESEEK_SNAPSHOT } from '../hideseek/snapshot';
import { runMatch, startMatch } from '../hideseek/match/runMatch';
import { HideSeekTrainer } from '../hideseek/trainer/trainer';
import { createArenaPool, type ArenaPool } from '../hideseek/world/pool';
import { decodeGenome, encodeGenome } from '../neat/serialize';
import { buildRoundReplay, replaySpecs } from './hideseekRecords';
import { createHideSeekRunConfig, hideSeekBlueprints, hideSeekSettingsOf } from './hideseekRunConfig';
import { hideSeekTrainerOptions, safeHideSeekHost } from './hideseekSetup';

const [starter, standard] = HIDESEEK_BLUEPRINTS;

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

describe('Hide and Seek run config', () => {
  it('freezes settings and fills defaults', () => {
    const c = createHideSeekRunConfig({ name: 'a', seed: -1, blueprint: standard, populationPerTeam: 20, layouts: ['open', 'open', 'shelter'], rounds: 2 });
    expect(c.env).toBe('hideseek');
    expect(c.seed).toBe(0xffffffff);
    expect(c.neat.populationSize).toBe(20);
    const s = hideSeekSettingsOf(c);
    expect(s.layouts).toEqual(['open', 'shelter']);
    expect(s.rounds).toBe(2);
    expect(s.reward).toBe('v1');
    expect(hideSeekBlueprints(c).seeker.id).toBe(standard.id);
  });

  it('keeps a separate seeker blueprint and changes the hash with it', () => {
    const same = createHideSeekRunConfig({ name: 'a', seed: 1, blueprint: standard, populationPerTeam: 10 });
    const split = createHideSeekRunConfig({ name: 'a', seed: 1, blueprint: standard, seekerBlueprint: starter, populationPerTeam: 10 });
    expect(hideSeekBlueprints(split).seeker.id).toBe(starter.id);
    expect(split.physicsHash).not.toBe(same.physicsHash);
    const o = hideSeekTrainerOptions(split);
    expect(o.seekerInputs).toEqual(starter.inputs);
    expect(o.hiderInputs).toEqual(standard.inputs);
  });

  it('rejects bad round counts and other environments', () => {
    expect(() => createHideSeekRunConfig({ name: 'a', seed: 1, blueprint: standard, populationPerTeam: 10, rounds: 5 })).toThrow();
    const c = createHideSeekRunConfig({ name: 'a', seed: 1, blueprint: standard, populationPerTeam: 10 });
    expect(() => hideSeekSettingsOf({ ...c, env: 'racing' })).toThrow('Not a Hide and Seek run');
  });

  it('builds trainers whose brains match the blueprint', () => {
    const c = createHideSeekRunConfig({ name: 'a', seed: 3, blueprint: standard, populationPerTeam: 6, rounds: 1 });
    const t = HideSeekTrainer.create(hideSeekTrainerOptions(c));
    expect(t.hiders.genomes).toHaveLength(6);
    expect(t.hiders.genomes[0].inputs).toHaveLength(blueprintInputCount(standard));
  });

  it('falls back to built-in rewards when a script does not compile', () => {
    const { host, error } = safeHideSeekHost('this is not a script');
    expect(error).toBeTruthy();
    expect(host.createHideSeekControllers).toBeUndefined();
  });
});

describe('round replays', () => {
  const c = createHideSeekRunConfig({ name: 'r', seed: 42, blueprint: starter, populationPerTeam: 4, rounds: 4 });

  it('store each genome once and survive the storage round trip', () => {
    const t = HideSeekTrainer.create(hideSeekTrainerOptions(c));
    const plan = t.planGeneration();
    const last = plan[plan.length - 1];
    const replay = buildRoundReplay(last, { generation: 0, round: 3, rounds: 4, scriptSource: null }, 6);
    expect(replay.matches).toHaveLength(6);
    expect(replay.genomes.length).toBeLessThan(12);
    const stored = { ...replay, genomes: replay.genomes.map((g) => decodeGenome(encodeGenome(g))) };
    const a = last.slice(0, 2).map((s) => runMatch(s, pool));
    const b = replaySpecs(stored).slice(0, 2).map((s) => runMatch(s, pool));
    expect(b).toEqual(a);
  });

  it('replay frames match the live round tick for tick', () => {
    const t = HideSeekTrainer.create(hideSeekTrainerOptions(c));
    const round = t.planGeneration()[0].slice(0, 2);
    const stride = HIDESEEK_SNAPSHOT.stride;
    const live = round.map((s) => startMatch(s, pool));
    const replay = replaySpecs(buildRoundReplay(round, { generation: 0, round: 0, rounds: 4, scriptSource: null })).map((s) => startMatch(s, pool));
    const a = new Float32Array(live.length * stride);
    const b = new Float32Array(live.length * stride);
    while (live.some((m) => !m.done)) {
      live.forEach((m, i) => (m.step(), m.snapshot(a, i * stride)));
      replay.forEach((m, i) => (m.step(), m.snapshot(b, i * stride)));
      expect(Array.from(b)).toEqual(Array.from(a));
    }
    [...live, ...replay].forEach((m) => m.release());
  });
});
