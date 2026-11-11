import { mixSeed } from '@/engine/core/rng';
import { Autopilot } from '@/engine/driving/autopilot/autopilot';
import { autopilotController, IDLE_BRAIN } from '@/engine/driving/autopilot/controller';
import { SIM_DT, SUV } from '@/engine/driving/car/params';
import { builtInCity, DEFAULT_CITY_ID } from '@/engine/driving/city/presets';
import { DrivingEnv } from '@/engine/driving/env';
import { FULL_DRIVING_INPUTS } from '@/engine/driving/sensors/inputConfig';
import { createDrivingSetup, drivingEnvOptions, type DrivingSetup } from '@/engine/driving/setup';
import { DRIVING_SNAPSHOT, WORLD_SIZE } from '@/engine/driving/snapshot';
import type { FrameBuffer, FrameSource } from '../frame/source';

/** A frame source fed by hand, the same shape as a worker stream. */
export class LocalSource implements FrameSource {
  prev: FrameBuffer | null = null;
  curr: FrameBuffer | null = null;
  count = 0;
  tags = new Int32Array(0);
  epoch = 0;
  /** Smoothed time between frames, ms, for blending. */
  interval = SIM_DT * 1000;
  private spare: Float32Array | null = null;

  constructor(private readonly size: number) {}

  /** A buffer to write the next frame into; the oldest one is recycled. */
  next(): Float32Array {
    return this.spare ?? new Float32Array(this.size);
  }

  push(buffer: Float32Array, tick: number, at: number): void {
    this.spare = this.prev?.buffer ?? null;
    this.prev = this.curr;
    this.curr = { buffer, tick, at };
  }

  alpha(now = performance.now()): number {
    if (!this.curr || !this.prev) return 1;
    return Math.min(1, Math.max(0, (now - this.curr.at) / this.interval));
  }
}

export interface PreviewOptions {
  cityId: string;
  level: number;
  seed: number;
  /** How many autopilot SUVs drive the route, spread out by start delays and pace. */
  cars: number;
}

/**
 * The preview's simulation on the main thread: a few autopilot SUVs on one
 * route through the city, stepped at 30 Hz against the wall clock. When
 * everyone is done the next trip starts with a new seed. It exists so the
 * city can be judged before the lab is wired; nothing here trains.
 */
export class PreviewSim {
  readonly population: LocalSource;
  readonly world: LocalSource;
  env!: DrivingEnv;
  setup!: DrivingSetup;
  private trip = 0;
  private clock = -1;
  private tick = 0;
  private finishedAt = -1;

  constructor(readonly opts: PreviewOptions) {
    this.population = new LocalSource(opts.cars * DRIVING_SNAPSHOT.stride);
    this.world = new LocalSource(WORLD_SIZE);
    this.start();
  }

  private start(): void {
    const city = builtInCity(this.opts.cityId) ?? builtInCity(DEFAULT_CITY_ID)!;
    this.setup = createDrivingSetup({ city, level: this.opts.level, seed: mixSeed(this.opts.seed, this.trip) });
    const pilots: Autopilot[] = [];
    const opts = drivingEnvOptions(this.setup, SUV, FULL_DRIVING_INPUTS, autopilotController(pilots));
    this.env = new DrivingEnv(opts);
    const n = this.opts.cars;
    for (let i = 0; i < n; i++) pilots.push(new Autopilot(opts.city, opts.route, this.env.world.state, SUV, { pace: 1 - 0.035 * (i % 5), delay: i * 2.2 }));
    this.env.reset(Array.from({ length: n }, () => IDLE_BRAIN), Array.from({ length: n }, (_, i) => i));
    this.population.count = n;
    this.population.tags = Int32Array.from({ length: n }, (_, i) => i);
    this.population.epoch++;
    this.world.epoch++;
    this.population.prev = this.population.curr = null;
    this.world.prev = this.world.curr = null;
    this.finishedAt = -1;
    this.publish(performance.now());
  }

  private publish(at: number): void {
    const p = this.population.next();
    this.env.snapshot(p);
    this.population.push(p, this.tick, at);
    const w = this.world.next();
    this.env.writeWorld(w);
    this.world.push(w, this.tick, at);
  }

  private stepOnce(at: number): void {
    if (this.env.done) {
      // Hold the finished scene a few seconds, then start the next trip.
      if (this.finishedAt < 0) this.finishedAt = this.tick;
      if (this.tick - this.finishedAt > 90) {
        this.trip++;
        this.start();
        return;
      }
    } else this.env.step();
    this.tick++;
    this.publish(at);
  }

  /** Steps as many ticks as real time asks for, at most a few per frame so a slow frame never snowballs. */
  advance(now: number, paused = false): void {
    if (this.clock < 0) this.clock = now;
    if (paused) {
      this.clock = now;
      return;
    }
    let steps = 0;
    while (now - this.clock >= SIM_DT * 1000 && steps < 4) {
      this.clock += SIM_DT * 1000;
      this.stepOnce(now);
      steps++;
    }
    if (now - this.clock > 500) this.clock = now;
  }

  /** Runs the simulation ahead without drawing, for a chosen moment in a screenshot. */
  fastForward(seconds: number): void {
    const ticks = Math.round(seconds / SIM_DT);
    const now = performance.now();
    for (let i = 0; i < ticks; i++) this.stepOnce(now);
  }
}
