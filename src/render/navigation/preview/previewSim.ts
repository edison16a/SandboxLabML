import { mixSeed } from '@/engine/core/rng';
import { buildCourse, type Course } from '@/engine/navigation/course/build';
import { formationSlots } from '@/engine/navigation/course/formation';
import { generateCourse } from '@/engine/navigation/course/generate';
import { namedCourse } from '@/engine/navigation/course/presets';
import { NavigationEnv } from '@/engine/navigation/env';
import { IDLE_BRAIN } from '@/engine/navigation/navigator/navigator';
import { DEFAULT_NAVIGATION_PARAMS } from '@/engine/navigation/params';
import { STANDARD_NAVIGATION_INPUTS } from '@/engine/navigation/sensors/inputConfig';
import { NAVIGATION_SNAPSHOT, navigationWorldSize } from '@/engine/navigation/snapshot';
import type { NavFeed } from '../types';
import { crowdController } from './crowdController';

const params = DEFAULT_NAVIGATION_PARAMS;
/** Most ticks one frame may run. A slow frame then slows the run down instead of piling up work. */
const MAX_TICKS_PER_FRAME = 4;
/** Wall seconds the finished episode stays on screen before the next course starts. */
const REST = 2.5;

export interface PreviewOptions {
  level: number;
  seed: number;
  agents: number;
  /** A named course instead of a generated one. */
  courseId?: string;
}

/**
 * A Navigation episode run on the main thread by a crowd of scripted
 * navigators, laid out as the feed the viewport reads. It stands in for
 * the lab's workers so the visuals can be judged on their own. Each
 * finished episode rests a moment, then the next course of the level
 * starts.
 */
export class PreviewSim implements NavFeed {
  course: Course | null = null;
  curr: Float32Array;
  prev: Float32Array;
  world: Float32Array;
  prevWorld: Float32Array;
  count: number;
  epoch = 0;
  timeScale = 1;
  inputs = STANDARD_NAVIGATION_INPUTS;
  follow: number | null = null;
  paused = false;
  /** Pause by itself once the episode clock reaches this, s. For screenshots of a moment that needs a few frames of history. */
  until = Infinity;
  private env!: NavigationEnv;
  private acc = 0;
  private rest = 0;
  private round = 0;

  constructor(private opts: PreviewOptions) {
    this.count = opts.agents;
    const n = opts.agents * NAVIGATION_SNAPSHOT.stride;
    this.curr = new Float32Array(n);
    this.prev = new Float32Array(n);
    this.world = new Float32Array(navigationWorldSize());
    this.prevWorld = new Float32Array(navigationWorldSize());
    this.start();
  }

  /** Blend from the previous tick to the latest. */
  alpha = (): number => Math.min(1, this.acc / params.dt);

  /** Starts the next episode: a fresh course of the level (or the named course again). */
  private start(): void {
    const { level, seed, agents, courseId } = this.opts;
    const named = courseId ? namedCourse(courseId) : undefined;
    const spec = named ?? generateCourse(level, mixSeed(seed, this.round));
    const course = buildCourse(spec, params);
    this.course = course;
    this.env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: crowdController(course, params) });
    // Slots are handed out as a lab would: one spot each, in a seeded order.
    this.env.reset(
      Array.from({ length: agents }, () => IDLE_BRAIN),
      Array.from({ length: agents }, (_, i) => mixSeed(seed, this.round, i)),
      formationSlots(agents, mixSeed(seed, this.round)),
    );
    this.round++;
    this.epoch++;
    this.acc = 0;
    this.rest = 0;
    this.write();
    this.write();
  }

  /** Copies the latest state into curr, keeping the one before in prev. */
  private write(): void {
    [this.prev, this.curr] = [this.curr, this.prev];
    [this.prevWorld, this.world] = [this.world, this.prevWorld];
    this.env.snapshot(this.curr);
    this.env.writeWorld(this.world);
  }

  /** Runs the simulation for `dt` wall seconds. */
  advance(dt: number): void {
    if (this.paused) return;
    if (this.env.time >= this.until) {
      this.paused = true;
      return;
    }
    const step = params.dt;
    if (this.env.done) {
      this.rest += dt;
      if (this.rest >= REST) this.start();
      return;
    }
    this.acc += Math.min(dt, 0.25) * this.timeScale;
    let ticks = 0;
    while (this.acc >= step && !this.env.done && this.env.time < this.until) {
      if (ticks++ >= MAX_TICKS_PER_FRAME) {
        this.acc = Math.min(this.acc, step);
        break;
      }
      this.env.step();
      this.write();
      this.acc -= step;
    }
  }

  /** Runs ahead `seconds` of simulation at once, for a screenshot of a later moment. */
  skip(seconds: number): void {
    const ticks = Math.round(seconds / params.dt);
    let t = 0;
    for (; t < ticks && !this.env.done; t++) {
      this.env.step();
      // The last two ticks are kept, so the view blends from one to the other as it would live.
      if (t >= ticks - 2) this.write();
    }
    if (t < ticks) {
      this.write();
      this.write();
    }
    this.acc = params.dt;
  }
}
