import { NAV_RUNNING, type NavAgent } from '../../navigation/agent';
import type { Course } from '../../navigation/course/build';
import type { NavigationEnv } from '../../navigation/env';
import { Network } from '../../neat/network';
import { CutClock, CUT, type CutTiming } from '../cut';
import type { HeroNavigator } from './file';
import { courseEnv } from './judge';

/** Ticks the first course has already run when the page opens on it, so the runner is in its stride. The poster shows this tick. */
export const NAVIGATOR_OPENING_TICK = 40;

/**
 * The hero's runner, as a pure simulation: the trained runner crosses the
 * file's courses one after another, forever, each with a fresh env and a
 * fresh copy of the brain, exactly as it was checked. After the finish
 * the movers keep sliding through the hold and the dip to dark, and the
 * next course goes in while the frame is dark.
 */
export class HeroRunLoop {
  /** Index of the course on screen. */
  index = 0;
  /** Counts courses started, so the page can tell a new episode. */
  episode = 0;
  env: NavigationEnv;
  /** The brain running this course. The landing page draws its live activations. */
  brain: Network;
  readonly clock: CutClock;

  constructor(
    readonly navigator: HeroNavigator,
    opening = NAVIGATOR_OPENING_TICK,
    cut: CutTiming = CUT,
  ) {
    this.clock = new CutClock(cut);
    this.brain = new Network(navigator.genome);
    this.env = this.build(0);
    this.clock.start(true);
    for (let k = 0; k < opening && !this.stopped; k++) this.env.step();
  }

  get agent(): NavAgent {
    return this.env.agents[0];
  }

  get course(): Course {
    return this.env.course;
  }

  /** True once the runner has crossed the line (or stopped for any other reason). */
  get stopped(): boolean {
    return this.agent.status !== NAV_RUNNING;
  }

  /** One tick: the movers and the runner move on, and the next course goes in once the cut is dark. */
  step(): void {
    this.env.step();
    if (!this.clock.step(this.stopped)) return;
    this.index = (this.index + 1) % this.navigator.courses.length;
    this.brain = new Network(this.navigator.genome);
    this.env = this.build(this.index);
    this.clock.start(false);
  }

  private build(k: number): NavigationEnv {
    this.episode++;
    const run = this.navigator.file.courses[k];
    return courseEnv(this.brain, this.navigator.file.inputs, this.navigator.courses[k], run.slot, run.seed);
  }
}
