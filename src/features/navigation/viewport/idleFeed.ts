import { mixSeed } from '@/engine/core/rng';
import type { Course } from '@/engine/navigation/course/build';
import { formationSlots } from '@/engine/navigation/course/formation';
import { NavigationEnv } from '@/engine/navigation/env';
import { builtinNavigationController } from '@/engine/navigation/builtinReward';
import { IDLE_BRAIN } from '@/engine/navigation/navigator/navigator';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { CourseCache } from '@/engine/navigation/pipeline/courseCache';
import { navigationOf } from '@/engine/navigation/pipeline/settings';
import { contentSpecs } from '@/engine/navigation/pipeline/setup';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { NAVIGATION_SNAPSHOT, navigationWorldSize } from '@/engine/navigation/snapshot';
import type { RunConfig } from '@/engine/training/runConfig';
import type { NavFeed } from '@/render/navigation/types';

/**
 * What the viewport shows before anything streams: the course the next
 * generation runs, with the population lined up on its start grid. It is
 * built once per run and content, on the main thread, from the same
 * course code the workers run, so the first live frame lands on the very
 * room already on screen.
 */
export class IdleFeed implements NavFeed {
  course: Course | null = null;
  curr: Float32Array | null = null;
  prev: Float32Array | null = null;
  world = new Float32Array(navigationWorldSize());
  prevWorld: Float32Array | null = null;
  count = 0;
  epoch = 0;
  timeScale = 1;
  inputs: NavigationInputConfig | null = null;
  follow: number | null = null;
  level = 0;
  private key = '';

  constructor(private readonly courses: CourseCache) {}

  alpha = (): number => 1;

  /** Rebuilds for a run and content when either changed. `agents` 0 shows the room alone. */
  sync(run: RunConfig | null, content: NavigationContent | null, agents: boolean): void {
    const key = run && content ? `${run.id}:${content.generation}:${content.curriculum.level}:${content.course}:${agents}` : '';
    if (key === this.key) return;
    this.key = key;
    this.epoch++;
    if (!run || !content || run.env !== 'navigation') {
      this.course = null;
      this.curr = null;
      this.count = 0;
      return;
    }
    const { settings, inputs } = navigationOf(run);
    const spec = contentSpecs(content, run.seed)[0];
    const course = this.courses.get(spec, settings.params);
    const count = agents ? run.neat.populationSize : 0;
    const env = new NavigationEnv({ course, params: settings.params, inputs, controller: builtinNavigationController });
    env.reset(
      Array.from({ length: count }, () => IDLE_BRAIN),
      Array.from({ length: count }, (_, i) => mixSeed(run.seed, content.generation, i)),
      formationSlots(count, mixSeed(run.seed, content.generation)),
    );
    this.curr = new Float32Array(Math.max(1, count) * NAVIGATION_SNAPSHOT.stride);
    env.snapshot(this.curr);
    env.writeWorld(this.world, 0);
    this.course = course;
    this.count = count;
    this.inputs = inputs;
    this.level = spec.level;
  }
}
