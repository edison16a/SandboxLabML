import { clamp, wrapAngle } from '../../core/math';
import type { DrivingLearner } from '../agent/learner';
import type { CarParams } from '../car/params';
import { SUV_SIZE } from '../car/params';
import type { City } from '../city/types';
import type { Route, RouteTurn } from '../route/route';
import { ALL_RED, LIGHT_FLASHING, LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW, lightRemaining, lightState } from '../signals/plan';
import type { WorldState } from '../world/state';
import { hazardAhead, oncomingTraffic } from './hazards';
import { crossTraffic, exitBlocked, exitCrossingQuiet, oncomingLeftTurn } from './junction';

/** Comfortable deceleration the autopilot plans with, m/s^2, the most it uses to stop for a yellow, and the firmest stop it makes at a line. */
const PLAN_BRAKE = 2.6;
const YELLOW_BRAKE = 4;
const FIRM_BRAKE = 7;
/** Sideways acceleration it accepts in a turn, m/s^2. */
const TURN_GRIP = 2.2;
/** How far before a stop line its front comes to rest, m. */
const LINE_GAP = 0.8;

/** Small per driver differences, so a few autopilots on one route spread out like a real population. */
export interface AutopilotStyle {
  /** Share of the speed limit it cruises at. */
  pace: number;
  /** Seconds it waits before setting off. */
  delay: number;
}

export const CALM_STYLE: AutopilotStyle = { pace: 0.94, delay: 0 };

/**
 * A hand written driver with perfect knowledge of the route and the city:
 * pure pursuit steering along the route, and a speed target that is the
 * lowest of the speed limit, the curve ahead, a stop at a red or yellow
 * line, the car ahead, people in the road or on a crossing it is about to
 * cross, a junction it may not enter yet, and the destination. Traffic
 * cannot see the SUV, so it drives defensively: it lets oncoming left
 * turners go first and never enters a junction it cannot leave. It proves
 * every level is drivable, is the benchmark's yardstick, and drives the
 * preview. It keeps a little state, so use one per learner. Evolved brains
 * never see it.
 */
export class Autopilot {
  /** The stop line (index into route.stops) it has decided to stop at, or -1. */
  private held = -1;
  private lastTime = 0;

  constructor(
    readonly city: City,
    readonly route: Route,
    readonly world: WorldState,
    readonly car: CarParams,
    readonly style: AutopilotStyle = CALM_STYLE,
  ) {}

  /** Steer and pedal for learner l, written into out[0] and out[1]. */
  drive(l: DrivingLearner, out: Float64Array): void {
    out[0] = this.steer(l);
    const target = this.targetSpeed(l);
    const v = l.car.speed;
    // Proportional speed control, with a firm hold once stopped so the car does not creep over a line.
    out[1] = target < 0.2 && v < 0.5 ? -0.4 : clamp((target - v) * 0.7, -1, 1);
  }

  private steer(l: DrivingLearner): number {
    const p = this.route.path;
    const v = l.car.speed;
    const look = 3.5 + 0.55 * v;
    const i = p.indexAt(l.progress + look, l.routeIndex);
    const dx = p.x[i] - l.car.x;
    const dy = p.y[i] - l.car.y;
    const alpha = wrapAngle(Math.atan2(dy, dx) - l.car.heading);
    const kappa = (2 * Math.sin(alpha)) / Math.max(1, Math.hypot(dx, dy));
    const fade = v / this.car.steerFadeSpeed;
    const available = this.car.steerMax / (1 + fade * fade);
    return clamp(Math.atan(kappa * this.car.wheelbase) / available, -1, 1);
  }

  /**
   * Where the front must stop for the next stop line, or Infinity to drive
   * on: a red light, a yellow it chose to stop for, or a junction it may not
   * enter yet. Once it decides to stop at a line it keeps to that decision
   * until the light turns green, even if its nose creeps a little past.
   */
  private lineStop(l: DrivingLearner): number {
    if (l.time < this.lastTime) this.held = -1;
    this.lastTime = l.time;
    const { route, city, world } = this;
    const s = l.sense;
    const v = l.car.speed;
    const front = l.progress + SUV_SIZE.length / 2;
    if (this.held >= 0) {
      const st = route.stops[this.held];
      const light = world.signalsOn ? lightState(world.time, city.signalOffsets[st.signal], st.axis) : LIGHT_FLASHING;
      if (light === LIGHT_GREEN || light === LIGHT_FLASHING || front > st.s + 3) this.held = -1;
      else return st.s - front - LINE_GAP;
    }
    if (s.stop < 0) return Infinity;
    const st = route.stops[s.stop];
    const lineAhead = s.lightDistance;
    let turn: RouteTurn | null = null;
    for (let k = 0; k < route.turns.length && !turn; k++) if (route.turns[k].node === st.node) turn = route.turns[k];
    if (s.light === LIGHT_RED && lineAhead < 60) this.held = s.stop;
    if (s.light === LIGHT_YELLOW && this.stopsForYellow(l, lineAhead, turn ? turn.end - turn.s : 24, st)) this.held = s.stop;
    if (this.held >= 0) return lineAhead - LINE_GAP;
    if (lineAhead > 25 || l.inIntersection || !turn) return Infinity;
    // Before the line: the junction must be free of anyone it could meet in there, and the lane beyond must have room.
    const dir = city.elements[turn.element].dir;
    const blocked =
      (turn.turn === -1 ? oncomingTraffic(city, world, st.node, dir) || !exitCrossingQuiet(city, world, turn.element) : oncomingLeftTurn(city, world, st.node, dir)) ||
      crossTraffic(city, world, st.node, dir) ||
      exitBlocked(route.path, world, turn.end, l.routeIndex, SUV_SIZE.length + 3);
    // Rolling too fast to stop before the line means it is already committed; creeping, it can always stop.
    const committed = v > 1 && lineAhead - LINE_GAP < (v * v) / (2 * FIRM_BRAKE);
    return blocked && !committed ? lineAhead - LINE_GAP : Infinity;
  }

  /**
   * Whether to stop for a yellow: always when a comfortable stop is
   * possible, and also with firm braking when going on would leave the SUV
   * in the junction or on its far crossing after the cross street gets green.
   */
  private stopsForYellow(l: DrivingLearner, lineAhead: number, through: number, st: { signal: number; axis: number }): boolean {
    const v = l.car.speed;
    const room = lineAhead - LINE_GAP;
    if (room > (v * v) / (2 * YELLOW_BRAKE)) return true;
    const left = lightRemaining(this.world.time, this.city.signalOffsets[st.signal], st.axis) + ALL_RED;
    const needed = (lineAhead + through + SUV_SIZE.length) / Math.max(v, 2);
    return needed > left && room > (v * v) / (2 * FIRM_BRAKE);
  }

  /**
   * The speed to aim for now. Every stop target is measured from the front
   * bumper to where the front should come to rest.
   */
  private targetSpeed(l: DrivingLearner): number {
    if (l.time < this.style.delay) return 0;
    const p = this.route.path;
    const v = l.car.speed;
    const half = SUV_SIZE.length / 2;
    let target = l.speedLimit * this.style.pace;
    // Curves ahead, within braking distance.
    const scan = (v * v) / (2 * PLAN_BRAKE) + 12;
    for (let d = 0; d < scan; d += 1) {
      const k = Math.abs(p.k[p.indexAt(l.progress + d, l.routeIndex)]);
      if (k > 1e-3) target = Math.min(target, Math.sqrt(TURN_GRIP / k + 2 * PLAN_BRAKE * d));
    }
    let stop = this.lineStop(l);
    const s = l.sense;
    if (s.car >= 0) {
      const lead = Math.max(0, v + s.relSpeed);
      target = Math.min(target, Math.sqrt(lead * lead + 2 * PLAN_BRAKE * Math.max(0, s.gap - 3 - v * 0.6)));
    }
    stop = Math.min(stop, hazardAhead(this.city, this.route, this.world, l.progress, l.routeIndex, half, 40));
    // Stop with the car's center on the destination.
    stop = Math.min(stop, l.remaining - 0.3);
    if (stop < Infinity) target = Math.min(target, Math.sqrt(2 * PLAN_BRAKE * Math.max(0, stop)));
    return Math.max(0, target);
  }
}
