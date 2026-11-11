import { clamp, wrapAngle } from '../../core/math';
import type { DrivingLearner } from '../agent/learner';
import type { CarParams } from '../car/params';
import { SUV_SIZE } from '../car/params';
import type { City } from '../city/types';
import type { Route } from '../route/route';
import { LIGHT_RED, LIGHT_YELLOW } from '../signals/plan';
import type { WorldState } from '../world/state';
import { crossTrafficInBox, hazardAhead, oncomingTraffic } from './hazards';

/** Comfortable deceleration the autopilot plans with, m/s^2, and the firmest it uses for a yellow. */
const PLAN_BRAKE = 2.6;
const YELLOW_BRAKE = 4;
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
 * cross, oncoming traffic before a left turn, and the destination. It
 * proves every level is drivable, is the benchmark's yardstick, and drives
 * the preview. Evolved brains never see it.
 */
export class Autopilot {
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
    let stop = Infinity;
    const s = l.sense;
    const lineAhead = s.stop >= 0 ? s.lightDistance : Infinity;
    if (s.light === LIGHT_RED && lineAhead < 60) stop = Math.min(stop, lineAhead - LINE_GAP);
    if (s.light === LIGHT_YELLOW && lineAhead - LINE_GAP > (v * v) / (2 * YELLOW_BRAKE)) stop = Math.min(stop, lineAhead - LINE_GAP);
    // Before the line: wait for oncoming traffic to turn left, and for the box to clear.
    if (s.stop >= 0 && lineAhead < 25 && !l.inIntersection) {
      const st = this.route.stops[s.stop];
      let turn = 0;
      let dir = 0;
      for (let k = 0; k < this.route.turns.length; k++) {
        const t = this.route.turns[k];
        if (t.node !== st.node) continue;
        turn = t.turn;
        dir = this.city.elements[t.element].dir;
        break;
      }
      if ((turn === -1 && oncomingTraffic(this.city, this.world, st.node, dir)) || crossTrafficInBox(this.city, this.world, st.node, dir)) stop = Math.min(stop, lineAhead - LINE_GAP);
    }
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
