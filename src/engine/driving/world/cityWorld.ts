import { Rng } from '../../core/rng';
import type { City } from '../city/types';
import type { DrivingLevel } from '../levels';
import { Pedestrians } from '../peds/pedestrians';
import { axisOf, lightState, walkState } from '../signals/plan';
import type { TrafficContext } from '../traffic/rules';
import { markThreats } from '../traffic/threats';
import { Traffic, type KeepClear } from '../traffic/traffic';
import { createWorldState, type WorldState } from './state';

/**
 * The city's scripted life for one episode: signals, people and traffic,
 * stepped once per tick before any learner moves. It depends only on the
 * city, the level and its seed, never on the learners, so every learner of
 * a generation sees the same city and a champion replayed alone sees it
 * again tick for tick.
 */
export class CityWorld {
  readonly state: WorldState;
  readonly peds: Pedestrians;
  readonly traffic: Traffic;
  private rng = new Rng(0);
  private keep: KeepClear | null = null;
  private readonly ctx: TrafficContext;
  /** Crossings a car is about to drive over, for people deciding whether to step out. */
  private readonly threat: Uint8Array;

  constructor(
    readonly city: City,
    readonly level: DrivingLevel,
  ) {
    this.state = createWorldState(city.signals.length);
    this.peds = new Pedestrians(city);
    this.traffic = new Traffic(city);
    this.threat = new Uint8Array(city.crosswalks.length);
    this.ctx = { time: 0, signalsOn: level.signals, signalOffsets: city.signalOffsets, busy: this.peds.busy, jayX: this.peds.jayX, jayY: this.peds.jayY, jayCount: 0 };
  }

  /** Starts the episode's world from `seed`, keeping traffic off the learners' start. */
  reset(seed: number, keep: KeepClear | null): void {
    this.rng = new Rng(seed);
    this.keep = keep;
    this.state.time = 0;
    this.state.signalsOn = this.level.signals;
    this.peds.reset(this.level.pedestrians, this.level, this.rng);
    this.traffic.reset(this.level.traffic, this.rng, keep);
    this.ctx.time = 0;
    markThreats(this.traffic.fleet, this.ctx, this.threat);
    this.writeState();
  }

  step(dt: number): void {
    const time = this.state.time;
    this.peds.step(dt, time, this.level.signals, this.level, this.rng, this.threat, this.state);
    const ctx = this.ctx;
    ctx.time = time;
    ctx.jayCount = this.peds.jayCount;
    this.traffic.step(dt, ctx, this.rng, this.keep);
    markThreats(this.traffic.fleet, ctx, this.threat);
    this.state.time = time + dt;
    this.writeState();
  }

  /** Light shown to traffic on `axis` at signal `signal` right now. */
  light(signal: number, axis: number): number {
    return lightState(this.state.time, this.city.signalOffsets[signal], axis, this.level.signals);
  }

  private writeState(): void {
    const s = this.state;
    this.peds.write(s);
    this.traffic.write(s);
    const city = this.city;
    for (let k = 0; k < city.signals.length; k++) {
      const node = city.nodes[city.signals[k]];
      const offset = city.signalOffsets[k];
      for (let d = 0; d < 4; d++) {
        // Traffic heading in direction d arrives from the arm opposite it.
        const arm = (d + 2) % 4;
        s.lights[k * 4 + d] = node.arms[arm] ? lightState(s.time, offset, axisOf(d), this.level.signals) : -1;
      }
      s.walks[k * 2] = walkState(s.time, offset, 0, this.level.signals);
      s.walks[k * 2 + 1] = walkState(s.time, offset, 1, this.level.signals);
    }
  }
}
