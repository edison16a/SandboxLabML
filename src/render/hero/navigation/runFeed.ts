import type { Course } from '@/engine/navigation/course/build';
import { DEFAULT_NAVIGATION_PARAMS } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { NAVIGATION_SNAPSHOT, navigationWorldSize } from '@/engine/navigation/snapshot';
import type { HeroNavigator } from '@/engine/hero/navigator/file';
import { HeroRunLoop, NAVIGATOR_OPENING_TICK } from '@/engine/hero/navigator/loop';
import type { NavFeed } from '@/render/navigation/types';
import { HeroFeed } from '../feed/heroFeed';

/**
 * The hero's runner as the Navigation renderer reads it: the pure
 * simulation (HeroRunLoop) stepped on the main thread from the canvas's
 * frame loop, laid out as the feed the lab viewport draws. The view always
 * follows the one runner, and its sensors are drawn from the very inputs
 * its brain read.
 */
export class RunFeed extends HeroFeed implements NavFeed {
  readonly loop: HeroRunLoop;
  course: Course | null = null;
  curr = new Float32Array(NAVIGATION_SNAPSHOT.stride);
  prev = new Float32Array(NAVIGATION_SNAPSHOT.stride);
  world = new Float32Array(navigationWorldSize());
  prevWorld = new Float32Array(navigationWorldSize());
  readonly count = 1;
  epoch = 0;
  readonly timeScale = 1;
  readonly inputs: NavigationInputConfig;
  readonly follow = 0;
  readonly inspect: { index: number; obs: ArrayLike<number> };
  private shownEpisode = -1;

  constructor(readonly navigator: HeroNavigator) {
    super(DEFAULT_NAVIGATION_PARAMS.dt);
    this.inputs = navigator.file.inputs;
    // One tick short of the opening, so the first frame blends from the tick before it.
    this.loop = new HeroRunLoop(navigator, (navigator.file.opening ?? NAVIGATOR_OPENING_TICK) - 1);
    this.inspect = { index: 0, obs: this.loop.env.lastObservation(0) };
    this.publish();
    this.tick();
  }

  protected tick(): void {
    this.loop.step();
    this.publish();
  }

  protected clock() {
    return this.loop.clock;
  }

  get genome() {
    return this.navigator.genome;
  }

  get brain() {
    return this.loop.brain;
  }

  /** Swaps in the newest tick. A new course writes it twice, so the view never blends across the cut. */
  private publish(): void {
    const { loop } = this;
    const fresh = loop.episode !== this.shownEpisode;
    if (fresh) {
      this.shownEpisode = loop.episode;
      this.course = loop.course;
      this.epoch++;
      this.inspect.obs = loop.env.lastObservation(0);
      this.write();
      this.notifyEpisode();
    }
    this.write();
  }

  /** Keeps the latest tick as the one before and writes the newest over the oldest buffers. */
  private write(): void {
    const agent = this.prev;
    this.prev = this.curr;
    this.curr = agent;
    const world = this.prevWorld;
    this.prevWorld = this.world;
    this.world = world;
    this.loop.env.snapshot(this.curr);
    this.loop.env.writeWorld(this.world);
  }
}
