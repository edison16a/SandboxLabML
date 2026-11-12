import { SIM_DT } from '@/engine/driving/car/params';
import { buildDrivingWorld, type DrivingWorld } from '@/engine/driving/setup';
import { DRIVING_SNAPSHOT, WORLD_SIZE } from '@/engine/driving/snapshot';
import type { HeroDriver } from '@/engine/hero/driver/file';
import { DRIVER_OPENING_TICK, HeroDriveLoop } from '@/engine/hero/driver/loop';
import type { Observation, ObservedInputs } from '@/render/driving/frame/observed';
import { HeroFeed } from '../feed/heroFeed';
import { HeroSource } from './heroSource';

/**
 * The hero's drive as the city renderer reads it. It steps the pure
 * simulation (HeroDriveLoop) on the main thread at 30 Hz from the canvas's
 * own frame loop, so it pauses whenever the canvas does, and hands the
 * renderer the last two snapshots of the SUV and of the city, plus the
 * inputs the brain read, in the shapes a worker stream has. A tick costs
 * about a tenth of a millisecond.
 */
export class DriveFeed extends HeroFeed {
  readonly loop: HeroDriveLoop;
  readonly population = new HeroSource(DRIVING_SNAPSHOT.stride, 1, this.alpha);
  readonly world = new HeroSource(WORLD_SIZE, 0, this.alpha);
  readonly observed: ObservedInputs;
  /** The city, route and level of the trip on screen. A new object each trip. */
  trip: DrivingWorld;
  private shownEpisode = -1;
  private readonly seen: [Observation, Observation];

  constructor(readonly driver: HeroDriver) {
    super(SIM_DT);
    // One tick short of the opening, so the first frame blends from the tick before it like every other frame.
    this.loop = new HeroDriveLoop(driver, (driver.file.opening ?? DRIVER_OPENING_TICK) - 1);
    const inputs = this.loop.env.inputCount;
    this.seen = [
      { index: 0, tick: -1, obs: new Float32Array(inputs) },
      { index: 0, tick: -1, obs: new Float32Array(inputs) },
    ];
    this.observed = { prev: null, curr: null };
    this.trip = buildDrivingWorld(driver.trips[0]);
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
    return this.driver.genome;
  }

  get brain() {
    return this.loop.brain;
  }

  /** Writes the newest tick into the sources. A new trip starts them over, so nothing blends across the cut. */
  private publish(): void {
    const { loop } = this;
    const env = loop.env;
    const fresh = loop.episode !== this.shownEpisode;
    if (fresh) {
      this.shownEpisode = loop.episode;
      this.trip = buildDrivingWorld(this.driver.trips[loop.trip]);
      this.population.restart();
      this.world.restart();
      this.observed.prev = this.observed.curr = null;
    }
    const tick = env.tick;
    env.snapshot(this.population.next());
    this.population.push(tick);
    env.writeWorld(this.world.next());
    this.world.push(tick);
    const o = this.observed;
    const spare = o.curr === this.seen[0] ? this.seen[1] : this.seen[0];
    spare.tick = tick;
    spare.obs.set(env.lastObservation(0));
    o.prev = o.curr;
    o.curr = spare;
    if (fresh) this.notifyEpisode();
  }
}
