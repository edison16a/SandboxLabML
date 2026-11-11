import type { Rng } from '../../core/rng';
import { ELEMENT_LANE, type City } from '../city/types';
import { pathPoint } from '../geometry/path';
import { CAR_DIMENSIONS, CAR_KINDS, FLAG_BRAKE, FLAG_LEFT, FLAG_RIGHT, MAX_TRAFFIC, type WorldState } from '../world/state';
import { Fleet } from './fleet';
import { trafficAccel, type TrafficContext } from './rules';
import { CORRIDOR_SHARE, type Corridor } from '../world/corridor';

/** A stretch of lane kept clear of traffic at the start, where the learners line up. */
export interface KeepClear {
  element: number;
  s0: number;
  s1: number;
}

/** Seconds a car may stand without moving before it is taken off and put back elsewhere. */
const STUCK = 45;
/** Spacing kept between cars when they are placed, m. */
const SPAWN_GAP = 14;

/**
 * The city's other drivers. They follow the lane graph with the car
 * following model, stop for red and for yellow when they can, yield to
 * people on crossings and to oncoming cars when turning left, and pick
 * their turns at random. They never react to the learners: that is what
 * lets a whole population share one city (see DrivingEnv).
 */
export class Traffic {
  readonly fleet: Fleet;
  private readonly lanes: number[];
  private readonly pt = pathPoint();
  private readonly accel: Float64Array;
  private corridor: Corridor | null = null;

  constructor(readonly city: City) {
    this.fleet = new Fleet(city, MAX_TRAFFIC);
    this.lanes = city.elements.filter((e) => e.kind === ELEMENT_LANE && e.path.length > 30).map((e) => e.id);
    this.accel = new Float64Array(MAX_TRAFFIC);
  }

  /**
   * Clears the streets and places `count` cars at random, away from `keep`.
   * With a corridor, most go on lanes near the route; cars stuck in a jam
   * are later put back on lanes away from it, where nobody watches them
   * appear.
   */
  reset(count: number, rng: Rng, keep: KeepClear | null, corridor: Corridor | null = null): void {
    const f = this.fleet;
    this.corridor = corridor && corridor.nearLanes.length > 0 ? corridor : null;
    f.count = 0;
    f.index();
    for (let tries = 0; f.count < Math.min(count, f.cap) && tries < count * 40; tries++) {
      const i = f.count;
      const kind = rng.int(CAR_KINDS);
      f.kind[i] = kind;
      f.len[i] = CAR_DIMENSIONS[kind][0];
      f.wid[i] = CAR_DIMENSIONS[kind][1];
      if (!this.spawn(i, rng, keep, this.corridor && rng.chance(CORRIDOR_SHARE) ? this.corridor.nearLanes : this.lanes)) continue;
      f.v0[i] = this.city.elements[f.el[i]].speedLimit * rng.range(0.82, 1.0);
      f.v[i] = f.v0[i] * rng.range(0.3, 0.9);
      f.count++;
      f.index();
    }
    this.pose();
  }

  /** Puts car i on a random lane from `lanes` with room around it. False if the pick was too crowded. */
  private spawn(i: number, rng: Rng, keep: KeepClear | null, lanes: number[]): boolean {
    const f = this.fleet;
    const lane = rng.pick(lanes);
    const len = this.city.elements[lane].path.length;
    const s = rng.range(6, len - 6);
    if (keep && keep.element === lane && s > keep.s0 && s < keep.s1) return false;
    for (let j = f.head[lane]; j >= 0; j = f.link[j]) if (j !== i && Math.abs(f.s[j] - s) < SPAWN_GAP) return false;
    f.place(i, lane, s, rng);
    return true;
  }

  /** One tick: everyone decides how hard to accelerate from the same moment, then all move. */
  step(dt: number, ctx: TrafficContext, rng: Rng, keep: KeepClear | null): void {
    const f = this.fleet;
    f.index();
    for (let i = 0; i < f.count; i++) this.accel[i] = trafficAccel(f, i, ctx);
    const elements = this.city.elements;
    for (let i = 0; i < f.count; i++) {
      const a = this.accel[i];
      const v = Math.max(0, f.v[i] + a * dt);
      f.accel[i] = (v - f.v[i]) / dt;
      f.v[i] = v;
      f.s[i] += v * dt;
      while (f.s[i] > elements[f.el[i]].path.length) f.advance(i, f.s[i] - elements[f.el[i]].path.length, rng);
      f.still[i] = v < 0.05 ? f.still[i] + dt : 0;
    }
    // A car that has stood for ages is in a jam of its own making: lift it out and drop it somewhere free.
    for (let i = 0; i < f.count; i++) {
      if (f.still[i] < STUCK) continue;
      f.index();
      const far = this.corridor && this.corridor.farLanes.length > 0 ? this.corridor.farLanes : this.lanes;
      if (this.spawn(i, rng, keep, far)) f.v[i] = 0;
      else f.still[i] = STUCK * 0.8;
    }
    this.pose();
  }

  /** World poses from each car's place on its element. */
  private pose(): void {
    const f = this.fleet;
    for (let i = 0; i < f.count; i++) {
      const p = this.city.elements[f.el[i]].path.sample(f.s[i], this.pt);
      f.px[i] = p.x;
      f.py[i] = p.y;
      f.ph[i] = Math.atan2(p.ty, p.tx);
    }
  }

  /** Copies the cars into the shared world state, with brake lights and indicators. */
  write(state: WorldState): void {
    const f = this.fleet;
    const elements = this.city.elements;
    state.carCount = f.count;
    for (let i = 0; i < f.count; i++) {
      state.carX[i] = f.px[i];
      state.carY[i] = f.py[i];
      state.carHeading[i] = f.ph[i];
      state.carSpeed[i] = f.v[i];
      state.carLength[i] = f.len[i];
      state.carWidth[i] = f.wid[i];
      state.carKind[i] = f.kind[i];
      const e = elements[f.el[i]];
      // Indicate on the turn itself and over the last 30 m before it.
      const turn = e.kind === ELEMENT_LANE ? (e.path.length - f.s[i] < 30 ? elements[f.nxt[i]].turn : 0) : e.turn;
      let flags = f.accel[i] < -0.8 || f.v[i] < 0.3 ? FLAG_BRAKE : 0;
      if (turn === -1) flags |= FLAG_LEFT;
      if (turn === 1) flags |= FLAG_RIGHT;
      state.carFlags[i] = flags;
    }
  }
}
