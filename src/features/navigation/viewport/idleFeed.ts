import { mixSeed } from '@/engine/core/rng';
import type { Course } from '@/engine/navigation/course/build';
import { formationSlots } from '@/engine/navigation/course/formation';
import { startSlotSeed } from '@/engine/training/episodeTrainer';
import { NavigationEnv } from '@/engine/navigation/env';
import { builtinNavigationController } from '@/engine/navigation/builtinReward';
import { IDLE_BRAIN } from '@/engine/navigation/navigator/navigator';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { CourseCache } from '@/engine/navigation/pipeline/courseCache';
import { navigationOf } from '@/engine/navigation/pipeline/settings';
import { contentSpecs } from '@/engine/navigation/pipeline/setup';
import type { CourseSpec } from '@/engine/navigation/course/types';
import type { NavigationParams } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { NAVIGATION_SNAPSHOT, navigationWorldSize } from '@/engine/navigation/snapshot';
import type { RunConfig } from '@/engine/training/runConfig';
import type { NavFeed } from '@/render/navigation/types';
import type { SandboxLineup } from '../state/sandboxState';

/**
 * What the viewport shows before anything streams, and in the moment
 * between two watched generations: the course the next generation runs,
 * with the population lined up on its start grid. In the Sandbox it is
 * the Sandbox course with its runners, while the replay starts. It is
 * built once per run and content (or lineup), on the main thread, from
 * the same course code the workers run, so the first live frame lands on
 * the very room already on screen.
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
  /** Set while nothing trains: the view then shows the whole course rather than one runner. */
  leaderless = false;
  level = 0;
  /** What the feed was last built from, compared field by field so a frame with nothing new builds no key. */
  private builtRun: RunConfig | null = null;
  private builtContent: NavigationContent | null = null;
  private builtAgents = false;
  private builtLineup: SandboxLineup | null = null;

  constructor(private readonly courses: CourseCache) {}

  alpha = (): number => 1;

  /** Rebuilds for a run and content when either changed. `agents` 0 shows the room alone. */
  sync(run: RunConfig | null, content: NavigationContent | null, agents: boolean): void {
    if (run === this.builtRun && content === this.builtContent && agents === this.builtAgents) return;
    this.builtRun = run;
    this.builtContent = content;
    this.builtAgents = agents;
    this.epoch++;
    if (!run || !content || run.env !== 'navigation') {
      this.course = null;
      this.curr = null;
      this.count = 0;
      return;
    }
    const { settings, inputs } = navigationOf(run);
    const spec = contentSpecs(content, run.seed)[0];
    const count = agents ? run.neat.populationSize : 0;
    this.lineUp(
      spec,
      settings.params,
      inputs,
      Array.from({ length: count }, (_, i) => mixSeed(run.seed, content.generation, i)),
      // The slots training hands out this generation, so the first live frame finds everyone where they stood.
      formationSlots(count, startSlotSeed(run.seed, content.generation)),
    );
  }

  /**
   * Rebuilds for a Sandbox lineup: its course with each runner on the spot
   * the replay starts it from, so the hand over to the replay is seamless.
   * Null shows nothing at all.
   */
  syncLineup(lineup: SandboxLineup | null): void {
    if (lineup === this.builtLineup) return;
    this.builtLineup = lineup;
    this.epoch++;
    if (!lineup) {
      this.course = null;
      this.curr = null;
      this.count = 0;
      return;
    }
    this.lineUp(lineup.spec, lineup.params, lineup.inputs, lineup.seeds, lineup.slots);
    this.leaderless = lineup.seeds.length === 0;
  }

  /** Stands one agent per seed on its slot of the course, at tick 0, and reads them out as a frame. */
  private lineUp(spec: CourseSpec, params: NavigationParams, inputs: NavigationInputConfig, seeds: number[], slots: number[]): void {
    const course = this.courses.get(spec, params);
    const count = seeds.length;
    const env = new NavigationEnv({ course, params, inputs, controller: builtinNavigationController });
    env.reset(
      seeds.map(() => IDLE_BRAIN),
      seeds,
      slots,
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
