import { describe, expect, it } from 'vitest';
import { testEpisode, trainEpisodeLesson, type PreparedWithBrain } from '../../lessons/episode/run';
import { prepareScript } from '../../lessons/prepare';
import { recordPreview } from '../../lessons/preview/record';
import { scriptEnv } from '../../script/envs';
import { LESSON_LEVEL, type NavigationPreviewScene } from '../pipeline/lessons';

const STARTER = scriptEnv('navigation')!.starter;

function prepared(source: string): PreparedWithBrain {
  const p = prepareScript(source);
  if (!p.ok) throw new Error(p.message);
  return p.value as PreparedWithBrain;
}

describe('Navigation lesson hooks', () => {
  it('test runs the starter: the test brain goes round the crate and finishes', async () => {
    const m = await testEpisode(prepared(STARTER));
    expect(m.finished).toBe(1);
    expect(m.died).toBe(0);
    expect(m.progress).toBe(1);
    expect(m.finishTime).toBeGreaterThan(3);
    // A whole walk is worth 10 and the finish 10 more, so the starter's rewards pass 20.
    expect(m.totalReward).toBeGreaterThan(20);
  });

  it('turns toward the finish when the brain has no path hint', async () => {
    const m = await testEpisode(prepared(STARTER.replace('navigation-standard', 'navigation-advanced')));
    expect(m.inputs).toBe(53);
    expect(m.progress).toBeGreaterThan(0.2);
  });

  it('records a preview with the course under the runner', async () => {
    const r = await recordPreview(STARTER);
    if (!r.ok || r.preview.kind !== 'episode') throw new Error('Expected an episode preview');
    const p = r.preview;
    const scene = p.scene as NavigationPreviewScene;
    expect(scene.level).toBe(LESSON_LEVEL);
    expect(scene.spec.obstacles.length).toBeGreaterThan(0);
    expect(p.fields.slice(0, 3)).toEqual(['x', 'z', 'yaw']);
    expect(p.rays).toHaveLength(12);
    expect(p.reach).toHaveLength(p.ticks * 12);
    expect(p.bounds!.maxX - p.bounds!.minX).toBeGreaterThan(scene.spec.length);
    expect(p.stopReason).toBe('finished');
  });

  it('trains a lesson population and measures the Navigation metrics', async () => {
    const m = await trainEpisodeLesson(prepared(STARTER), 3);
    expect(m).not.toBeNull();
    expect(Object.keys(m!)).toEqual(expect.arrayContaining(['bestFitness', 'species', 'progress', 'level', 'finishShare', 'eliteShare', 'deathShare']));
    expect(m!.level).toBeGreaterThanOrEqual(LESSON_LEVEL);
  }, 30_000);
});
