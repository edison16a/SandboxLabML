import type { Rng } from '../../core/rng';
import { DIR_X, DIR_Y, ROAD_HALF, WALK_LINE } from '../city/dimensions';
import type { City } from '../city/types';
import { pathPoint, projection } from '../geometry/path';
import type { DrivingLevel } from '../levels';
import { WALK_FLASHING, WALK_GO, walkState } from '../signals/plan';
import { MAX_PEDS, PED_CROSS, PED_JAYWALK, PED_WAIT, PED_WALK, type WorldState } from '../world/state';
import { Crowd, CURB_GAP, STRIDE } from './crowd';
import { CORRIDOR_SHARE, type Corridor } from '../world/corridor';
import { jaywalkTarget, reachedCrossing, ringCrossings, type RingCrossings } from './paths';

/** Chance that someone reaching a crossing takes it rather than walking on. */
const TAKE_CROSSING = 0.6;
/** How fast people drift back to their side of the sidewalk, m/s. */
const DRIFT = 0.5;

/**
 * Walks the city's people. They follow the sidewalks, wait at the curb for
 * the walk signal and cross on it once no turning car is coming; at rush
 * hour a few go on the flashing hand or cross mid block when the street is
 * clear. They see traffic but never the learners, which keeps one shared
 * city fair for the whole population.
 */
export class Pedestrians {
  readonly crowd = new Crowd();
  /** Per crossing: someone is on it or about to step onto it, so drivers must wait. */
  readonly busy: Uint8Array;
  /** People crossing mid block this tick, for drivers to watch. */
  readonly jayX = new Float64Array(MAX_PEDS);
  readonly jayY = new Float64Array(MAX_PEDS);
  jayCount = 0;
  private readonly points: RingCrossings[];
  private readonly pt = pathPoint();
  private readonly proj = projection();

  constructor(readonly city: City) {
    this.busy = new Uint8Array(city.crosswalks.length);
    this.points = ringCrossings(city);
  }

  /** Places `count` people on the sidewalks; with a corridor, most of them on the blocks along the route. */
  reset(count: number, level: DrivingLevel, rng: Rng, corridor: Corridor | null = null): void {
    const c = this.crowd;
    c.count = Math.min(count, MAX_PEDS);
    const rings = this.city.rings;
    const all = rings.map((_, k) => k);
    const near = corridor && corridor.nearRings.length > 0 ? corridor.nearRings : all;
    for (let i = 0; i < c.count; i++) {
      // Spread people by sidewalk length, so a long loop gets its share.
      const pool = rng.chance(CORRIDOR_SHARE) ? near : all;
      let pick = rng.next() * pool.reduce((a, k) => a + rings[k].length, 0);
      let n = 0;
      while (n < pool.length - 1 && pick > rings[pool[n]].length) pick -= rings[pool[n++]].length;
      c.ring[i] = pool[n];
      c.s[i] = Math.min(pick, rings[pool[n]].length);
      c.dir[i] = rng.chance(0.5) ? 1 : -1;
      c.speed[i] = rng.range(1.1, 1.6);
      c.pref[i] = -c.dir[i] * 0.45 + rng.range(-0.35, 0.35);
      c.lat[i] = c.pref[i];
      c.mode[i] = PED_WALK;
      c.spread[i] = rng.range(-1.1, 1.1);
      c.late[i] = rng.chance(level.lateCross) ? 1 : 0;
      c.cooldown[i] = 0;
      c.phase[i] = rng.next();
      c.look[i] = rng.int(256);
      this.placeOnRing(i);
    }
  }

  /** Where person i stands on their loop, from ring, s and lat. */
  private placeOnRing(i: number): void {
    const c = this.crowd;
    const p = this.city.rings[c.ring[i]].sample(c.s[i], this.pt);
    c.x[i] = p.x - p.ty * c.lat[i];
    c.y[i] = p.y + p.tx * c.lat[i];
    c.heading[i] = Math.atan2(p.ty * c.dir[i], p.tx * c.dir[i]);
  }

  /** The spot by the curb at one end of a crossing where people wait, spread along the band. */
  private waitSpot(i: number, cw: number, end: number): void {
    const c = this.crowd;
    const k = this.city.crosswalks[cw];
    const ex = end === 0 ? k.ax : k.bx;
    const ey = end === 0 ? k.ay : k.by;
    const back = WALK_LINE - ROAD_HALF - CURB_GAP;
    c.tx[i] = ex + ((k.x - ex) / WALK_LINE) * back + DIR_X[k.arm] * c.spread[i];
    c.ty[i] = ey + ((k.y - ey) / WALK_LINE) * back + DIR_Y[k.arm] * c.spread[i];
  }

  /** Moves person i toward their target; true on arrival. */
  private walkTo(i: number, dt: number, pace: number): boolean {
    const c = this.crowd;
    const dx = c.tx[i] - c.x[i];
    const dy = c.ty[i] - c.y[i];
    const d = Math.hypot(dx, dy);
    const step = c.speed[i] * pace * dt;
    if (d <= step) {
      c.x[i] = c.tx[i];
      c.y[i] = c.ty[i];
      return true;
    }
    c.x[i] += (dx / d) * step;
    c.y[i] += (dy / d) * step;
    c.heading[i] = Math.atan2(dy, dx);
    c.phase[i] = (c.phase[i] + step / STRIDE) % 1;
    return false;
  }

  /** Steps back onto a loop where a crossing ended, facing a random way. */
  private rejoin(i: number, rng: Rng): void {
    const c = this.crowd;
    const ring = this.city.rings[c.toRing[i]];
    ring.project(c.x[i], c.y[i], ring.indexAt(c.toS[i]), 8, this.proj);
    c.ring[i] = c.toRing[i];
    c.s[i] = this.proj.s;
    c.lat[i] = this.proj.lateral;
    c.dir[i] = rng.chance(0.5) ? 1 : -1;
    c.pref[i] = -c.dir[i] * 0.45 + c.spread[i] * 0.3;
    c.cooldown[i] = 6;
    c.mode[i] = PED_WALK;
  }

  /**
   * One tick. `threat` marks crossings a car is about to drive over and
   * `world` holds last tick's traffic: people look both ways and only step
   * out when no car is coming.
   */
  step(dt: number, time: number, signalsOn: boolean, level: DrivingLevel, rng: Rng, threat: Uint8Array, world: WorldState): void {
    const c = this.crowd;
    const city = this.city;
    this.busy.fill(0);
    this.jayCount = 0;
    for (let i = 0; i < c.count; i++) {
      const mode = c.mode[i];
      if (mode === PED_WALK) {
        const ring = city.rings[c.ring[i]];
        const ds = c.speed[i] * dt;
        const s0 = c.s[i];
        c.s[i] = (((s0 + ds * c.dir[i]) % ring.length) + ring.length) % ring.length;
        c.cooldown[i] -= ds;
        c.lat[i] += Math.max(-DRIFT * dt, Math.min(DRIFT * dt, c.pref[i] - c.lat[i]));
        c.phase[i] = (c.phase[i] + ds / STRIDE) % 1;
        this.placeOnRing(i);
        if (c.cooldown[i] <= 0) {
          const k = reachedCrossing(this.points[c.ring[i]], s0, ds * c.dir[i], ring.length);
          if (k >= 0 && rng.chance(TAKE_CROSSING)) {
            c.crossing[i] = this.points[c.ring[i]].cw[k];
            c.end[i] = this.points[c.ring[i]].end[k];
            c.mode[i] = PED_WAIT;
            this.waitSpot(i, c.crossing[i], c.end[i]);
          } else if (k >= 0) c.cooldown[i] = 3;
        }
        if (level.jaywalk > 0 && c.mode[i] === PED_WALK && rng.chance((level.jaywalk / 60) * dt) && jaywalkTarget(city, c, i, this.proj, world)) c.mode[i] = PED_JAYWALK;
      } else if (mode === PED_WAIT) {
        const k = city.crosswalks[c.crossing[i]];
        const walk = walkState(time, city.signalOffsets[city.nodes[k.node].signal], k.walkAxis, signalsOn);
        const arrived = this.walkTo(i, dt, 1);
        if (arrived) c.heading[i] = Math.atan2(k.y - c.y[i], k.x - c.x[i]);
        if (arrived && (walk === WALK_GO || (walk === WALK_FLASHING && c.late[i])) && !threat[k.id]) {
          this.busy[k.id] = 1;
          const other = 1 - c.end[i];
          this.waitSpot(i, k.id, other);
          c.toRing[i] = other === 0 ? k.ringA : k.ringB;
          c.toS[i] = other === 0 ? k.sA : k.sB;
          c.mode[i] = PED_CROSS;
        }
      } else {
        // Crossing, at a crossing or mid block: straight over, a little brisker than a stroll.
        if (mode === PED_CROSS) this.busy[c.crossing[i]] = 1;
        else {
          this.jayX[this.jayCount] = c.x[i];
          this.jayY[this.jayCount++] = c.y[i];
        }
        if (this.walkTo(i, dt, 1.1)) this.rejoin(i, rng);
      }
    }
  }

  write(state: WorldState): void {
    const c = this.crowd;
    state.pedCount = c.count;
    for (let i = 0; i < c.count; i++) {
      state.pedX[i] = c.x[i];
      state.pedY[i] = c.y[i];
      state.pedHeading[i] = c.heading[i];
      state.pedPhase[i] = c.phase[i];
      const standing = c.mode[i] === PED_WAIT && c.x[i] === c.tx[i] && c.y[i] === c.ty[i];
      state.pedState[i] = standing ? PED_WAIT : c.mode[i] === PED_WAIT ? PED_WALK : c.mode[i] === PED_JAYWALK ? PED_JAYWALK : c.mode[i] === PED_CROSS ? PED_CROSS : PED_WALK;
      state.pedLook[i] = c.look[i];
    }
  }
}
