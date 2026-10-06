import { mixSeed } from '@/engine/core/rng';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { RacingEnv, RACING_SNAPSHOT } from '@/engine/racing/env';
import { envOptionsFor, TrackCache, type RacingSetup } from '@/engine/training/racingSetup';
import { hostFor } from '@/engine/training/scriptHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';

export interface GhostSpec {
  generation: number;
  genome: Genome;
  seed: number;
  scriptSource: string | null;
  /** Start grid slot. Left out, the ghost starts on the line where it trained. */
  slot?: number;
}

export interface GhostTelemetry {
  generation: number;
  distance: Float32Array;
  speed: Float32Array;
  /** Brake pedal per tick, 0 to 1, for the brake map. */
  brake: Float32Array;
}

/**
 * Re-simulates stored champions as ghosts. Ghosts are driven by the same
 * RacingEnv as training, so they reproduce their original laps exactly.
 * Ghosts trained under different script versions get separate envs, stepped
 * in lockstep and merged into one stream.
 */
export class GhostPlayer {
  private readonly tracks = new TrackCache();
  private setup: RacingSetup | null = null;
  private ghosts: GhostSpec[] = [];
  private envs: Array<{ env: RacingEnv; order: number[] }> = [];
  private pacer: Pacer | null = null;
  private loop = true;
  private run = 0;
  private scratch = new Float32Array(RACING_SNAPSHOT.stride * 64);

  constructor(private readonly stream: StreamSender) {}

  setScene(setup: RacingSetup, ghosts: GhostSpec[]): void {
    this.setup = setup;
    this.ghosts = ghosts;
  }

  /** Restarts every ghost from the start line at `speed` times real time. */
  play(speed: number, loop: boolean): void {
    this.stop();
    if (!this.setup || this.ghosts.length === 0) return;
    this.loop = loop;
    this.build();
    const runId = ++this.run;
    const count = this.ghosts.length;
    this.stream.ring.resize(count * RACING_SNAPSHOT.stride);
    this.stream.send({ kind: 'start', stream: 'ghosts', generation: 0, count, tags: Int32Array.from(this.ghosts.map((g) => g.generation)) });
    const pacer = new Pacer(
      speed,
      30,
      (n) => {
        for (let k = 0; k < n; k++) {
          let alive = false;
          for (const e of this.envs) {
            if (!e.env.done) e.env.step();
            alive ||= !e.env.done;
          }
          if (!alive) return false;
        }
        return true;
      },
      () => this.sendFrame(),
      () => {
        this.sendFrame();
        if (this.loop && runId === this.run) setTimeout(() => runId === this.run && this.play(speed, true), 1200);
      },
    );
    this.pacer = pacer;
    pacer.start();
  }

  setSpeed(speed: number): void {
    this.pacer?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.pacer?.setPaused(paused);
  }

  stop(): void {
    this.pacer?.stop();
    this.pacer = null;
  }

  /**
   * Speed against distance for every champion in the scene, computed
   * headless in one pass. Copies of one champion share a line, taken from
   * the copy nearest the front of the grid.
   */
  telemetry(): GhostTelemetry[] {
    if (!this.setup) return [];
    const front = new Map<number, GhostSpec>();
    for (const g of this.ghosts) {
      const seen = front.get(g.generation);
      if (!seen || (g.slot ?? 0) < (seen.slot ?? 0)) front.set(g.generation, g);
    }
    return [...front.values()].map((g) => {
      const env = this.makeEnv([g]);
      const dist: number[] = [];
      const speed: number[] = [];
      const brake: number[] = [];
      while (!env.done) {
        env.step();
        const rc = env.cars[0];
        dist.push(rc.progress);
        speed.push(rc.car.speed);
        brake.push(Math.max(0, -rc.car.pedal));
      }
      return { generation: g.generation, distance: Float32Array.from(dist), speed: Float32Array.from(speed), brake: Float32Array.from(brake) };
    });
  }

  private makeEnv(ghosts: GhostSpec[]): RacingEnv {
    const setup = this.setup as RacingSetup;
    const source = ghosts[0]?.scriptSource ?? null;
    const track = this.tracks.get(setup.track);
    const env = new RacingEnv(envOptionsFor({ ...setup, scriptSource: source }, track, hostFor(source), mixSeed(0x9405)));
    env.reset(
      ghosts.map((g) => new Network(g.genome)),
      ghosts.map((g) => g.seed),
      ghosts.map((g) => g.slot ?? 0),
    );
    return env;
  }

  private build(): void {
    const groups = new Map<string | null, number[]>();
    this.ghosts.forEach((g, i) => {
      const list = groups.get(g.scriptSource);
      if (list) list.push(i);
      else groups.set(g.scriptSource, [i]);
    });
    this.envs = [...groups.values()].map((order) => ({ env: this.makeEnv(order.map((i) => this.ghosts[i])), order }));
  }

  private sendFrame(): void {
    const buffer = this.stream.ring.take();
    if (!buffer) return;
    const stride = RACING_SNAPSHOT.stride;
    let tmp = this.scratch;
    let tick = 0;
    for (const { env, order } of this.envs) {
      if (tmp.length < env.cars.length * stride) tmp = this.scratch = new Float32Array(env.cars.length * stride);
      env.snapshot(tmp);
      order.forEach((ghostIndex, k) => buffer.set(tmp.subarray(k * stride, (k + 1) * stride), ghostIndex * stride));
      tick = Math.max(tick, env.tick);
    }
    this.stream.send({ kind: 'frame', stream: 'ghosts', generation: 0, tick, count: this.ghosts.length, buffer, inspect: this.inspected() });
  }

  /** Observation and outputs of the inspected ghost, for the inputs overlay. */
  private inspected() {
    const index = this.stream.inspect;
    if (index === null) return undefined;
    for (const { env, order } of this.envs) {
      const k = order.indexOf(index);
      if (k < 0) continue;
      const car = env.cars[k].car;
      return { index, obs: Float32Array.from(env.lastObservation(k)), out: Float32Array.from([car.steerCmd, car.pedal]) };
    }
    return undefined;
  }
}
