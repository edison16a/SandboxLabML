import { STATUS_DRIVING, type DrivingLearner } from '../../driving/agent/learner';
import type { DrivingEnv } from '../../driving/env';
import { Network } from '../../neat/network';
import { CutClock, type CutTiming, CUT } from '../cut';
import type { HeroDriver } from './file';
import { tripEnv } from './judge';

/**
 * Ticks the first trip has already driven when the page opens on it, so
 * the hero opens on an SUV under way with its sensors out rather than one
 * parked at the curb. The poster is a still of exactly this tick.
 */
export const DRIVER_OPENING_TICK = 75;

/**
 * The hero's drive, as a pure simulation: the trained SUV drives the
 * file's trips one after another, forever. Each trip is a fresh env and a
 * fresh copy of the brain, built exactly as the trip was checked, so every
 * pass round the loop is the same drive. After the SUV arrives the city
 * keeps living through the hold and the dip to dark, and the next trip
 * starts while the frame is dark.
 */
export class HeroDriveLoop {
  /** Index of the trip on screen. */
  trip = 0;
  /** Counts trips started, so the page knows when to put the cameras back behind the SUV. */
  episode = 0;
  env: DrivingEnv;
  /** The brain driving this trip. The landing page draws its live activations. */
  brain: Network;
  readonly clock: CutClock;

  constructor(
    readonly driver: HeroDriver,
    opening = DRIVER_OPENING_TICK,
    cut: CutTiming = CUT,
  ) {
    this.clock = new CutClock(cut);
    this.brain = new Network(driver.genome);
    this.env = this.build(0);
    this.clock.start(true);
    for (let k = 0; k < opening && !this.stopped; k++) this.env.step();
  }

  /** The hero SUV of the trip on screen. */
  get learner(): DrivingLearner {
    return this.env.learners[0];
  }

  /** True once the SUV has arrived (or stopped for any other reason). */
  get stopped(): boolean {
    return this.learner.status !== STATUS_DRIVING;
  }

  /** One 1/30 s tick: the city and the SUV move on, and the next trip starts once the cut is dark. */
  step(): void {
    this.env.step();
    if (!this.clock.step(this.stopped)) return;
    this.trip = (this.trip + 1) % this.driver.trips.length;
    this.brain = new Network(this.driver.genome);
    this.env = this.build(this.trip);
    this.clock.start(false);
  }

  private build(k: number): DrivingEnv {
    this.episode++;
    const { file, trips } = this.driver;
    return tripEnv(this.brain, file.inputs, file.brainSeed, trips[k]);
  }
}
