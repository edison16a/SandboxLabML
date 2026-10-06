import { mixSeed } from '@/engine/core/rng';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { evaluateRacing, resultOf, type RacingResult } from '@/engine/racing/episode';
import { RacingEnv, RACING_SNAPSHOT } from '@/engine/racing/env';
import { envOptionsFor, TrackCache, type RacingSetup } from '@/engine/training/racingSetup';
import { hostFor, type ScriptHost } from '@/engine/training/scriptHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';

export interface LiveRacingRequest {
  setup: RacingSetup;
  genomes: Genome[];
  seeds: number[];
  generation: number;
  speed: number;
  /** Species id per car, for coloring. */
  tags: number[];
}

/**
 * Racing simulation inside a sim worker. Headless batches return results as
 * fast as possible; a live run paces itself to real time and streams a
 * snapshot of every car to the main thread.
 */
export class RacingSim {
  private readonly tracks = new TrackCache();
  private host: { source: string | null; host: ScriptHost } | null = null;
  private live: Pacer | null = null;
  private liveEnv: RacingEnv | null = null;

  private hostFor(source: string | null): ScriptHost {
    if (!this.host || this.host.source !== source) this.host = { source, host: hostFor(source) };
    return this.host.host;
  }

  evaluate(setup: RacingSetup, genomes: Genome[], seeds: number[], generation: number): RacingResult[] {
    const track = this.tracks.get(setup.track);
    const opts = envOptionsFor(setup, track, this.hostFor(setup.scriptSource), mixSeed(generation, 0x51));
    return evaluateRacing(genomes, opts, seeds);
  }

  runLive(req: LiveRacingRequest, stream: StreamSender): Promise<RacingResult[]> {
    this.live?.stop();
    const track = this.tracks.get(req.setup.track);
    const opts = envOptionsFor(req.setup, track, this.hostFor(req.setup.scriptSource), mixSeed(req.generation, 0x51));
    const env = new RacingEnv(opts);
    env.reset(
      req.genomes.map((g) => new Network(g)),
      req.seeds,
    );
    this.liveEnv = env;
    const count = req.genomes.length;
    stream.ring.resize(count * RACING_SNAPSHOT.stride);
    stream.send({ kind: 'start', stream: 'population', generation: req.generation, count, tags: Int32Array.from(req.tags) });

    return new Promise((resolve) => {
      const pacer = new Pacer(
        req.speed,
        30,
        (n) => {
          for (let k = 0; k < n && !env.done; k++) env.step();
          return !env.done;
        },
        () => this.sendFrame(env, stream, req.generation),
        () => {
          this.sendFrame(env, stream, req.generation);
          stream.send({ kind: 'end', stream: 'population', generation: req.generation });
          if (this.live === pacer) this.live = null;
          resolve(env.cars.map(resultOf));
        },
      );
      this.live = pacer;
      pacer.start();
    });
  }

  private sendFrame(env: RacingEnv, stream: StreamSender, generation: number): void {
    const buffer = stream.ring.take();
    if (!buffer) return;
    env.snapshot(buffer);
    const msg = { kind: 'frame' as const, stream: 'population' as const, generation, tick: env.tick, count: env.cars.length, buffer };
    const i = stream.inspect;
    let inspect;
    if (i !== null && i >= 0 && i < env.cars.length) {
      const obs = Float32Array.from(env.lastObservation(i));
      const rc = env.cars[i].car;
      inspect = { index: i, obs, out: Float32Array.from([rc.steerCmd, rc.pedal]) };
    }
    let rays: Float32Array | undefined;
    if (stream.rays) {
      const per = env.opts.inputs.rays.count;
      rays = new Float32Array(env.cars.length * per);
      const range = env.opts.inputs.rays.range;
      env.cars.forEach((c, k) => {
        for (let r = 0; r < per; r++) rays![k * per + r] = c.rays[r] / range;
      });
    }
    stream.send({ ...msg, inspect, rays });
  }

  setSpeed(speed: number): void {
    this.live?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.live?.setPaused(paused);
  }

  stopLive(): void {
    this.live?.stop();
    this.live = null;
    this.liveEnv = null;
  }
}
