import { describe, expect, it } from 'vitest';
import { NAVIGATION_BLUEPRINTS } from '../../navigation/pipeline/blueprints';
import { navigationSettings } from '../../navigation/pipeline/settings';
import { navigationTestBrain } from '../../navigation/pipeline/testBrain';
import { navigationInputSchema } from '../../navigation/sensors/inputSchema';
import { Population } from '../../neat/population';
import type { Genome } from '../../neat/types';
import { createEpisodeRunConfig } from '../../training/newRun';
import { runShape } from '../../training/runConfig';
import { runBenchmark } from '../index';
import { NAVIGATION_RADAR_AXES } from '../navigation/axes';
import { EXAM_LEVELS, EXAM_SLOTS, examRooms } from '../navigation/exam';
import { composite, scoreRun } from '../navigation/scoring';
import '../../script/compiler';

const blueprint = NAVIGATION_BLUEPRINTS[1];
const config = (script?: string) =>
  createEpisodeRunConfig({ env: 'navigation', name: 'bench', seed: 3, blueprint, populationSize: 10, settings: { ...navigationSettings() }, ...(script ? { script: { source: script, hash: 'h', customSensors: 0 } } : {}) });

/** The lesson test brain: it follows the path hint, so it should get through most rooms. */
const follower = (): Genome => navigationTestBrain(runShape(config()), navigationInputSchema(blueprint.inputs));
/** A brain whose outputs are always zero: it never leaves the grid. */
function idle(): Genome {
  const g = Population.create(runShape(config()), 1, { populationSize: 1 }).genomes[0];
  for (const c of g.connections) c.weight = 0;
  return g;
}

describe('the Navigation exam', () => {
  it('covers every level from 1 to 6 with held out rooms the navigator finishes', () => {
    const rooms = examRooms();
    expect(new Set(rooms.map((r) => r.level))).toEqual(new Set(EXAM_LEVELS));
    expect(rooms.some((r) => r.id === 'switchback') && rooms.some((r) => r.id === 'clockwork')).toBe(true);
    for (const room of rooms) {
      expect(room.par).toHaveLength(EXAM_SLOTS.length);
      for (const t of room.par) expect(t).toBeLessThan(room.course.timeLimit);
    }
  });

  it('scores a still brain 0, and the path follower far above a random one', async () => {
    const still = await runBenchmark(config(), idle());
    expect(still?.score).toBe(0);
    const good = await runBenchmark(config(), follower());
    const random = await runBenchmark(config(), Population.create(runShape(config()), 9, { populationSize: 1 }).genomes[0]);
    expect(good!.score).toBeGreaterThan(40);
    expect(good!.score).toBeGreaterThan(random!.score + 20);
    expect(Object.keys(good!.radar).sort()).toEqual(NAVIGATION_RADAR_AXES.map((a) => a.key).sort());
    expect(good!.parts.map((p) => p.id)).toEqual(EXAM_LEVELS.map((l) => `level-${l}`));
  }, 60_000);

  it('gives the same score every time, whatever the script rewards', async () => {
    const plain = await runBenchmark(config(), follower());
    const shaped = await runBenchmark(config('script "s" for navigation v1\nbrain navigation-standard\neach tick {\n  act(move: brain.move, turn: brain.turn)\n  reward +100 when agent.died\n  stop "x" when agent.time > 1 s\n}\n'), follower());
    expect(shaped?.score).toBe(plain?.score);
  }, 60_000);

  it('composes the score from the documented weights', () => {
    const run = { progress: 1, finished: true, died: false, finishTime: 10, par: 10, hazards: true };
    expect(scoreRun(run)).toEqual({ completion: 1, safety: 1, efficiency: 1 });
    expect(composite([[scoreRun(run)]]).score).toBeCloseTo(100);
    const dead = scoreRun({ ...run, finished: false, died: true, progress: 0.5, finishTime: 0 });
    expect(dead).toEqual({ completion: 0.5, safety: 0, efficiency: 0 });
    // Completion 40% of 0.5, generalization 20% of 0.5, nothing for safety or efficiency.
    expect(composite([[dead]]).score).toBeCloseTo(30);
  });
});
