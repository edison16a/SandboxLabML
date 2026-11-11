import * as THREE from 'three';
import { createCar, stepCar } from '@/engine/driving/car/dynamics';
import { SIM_DT, type CarParams } from '@/engine/driving/car/params';

/** Chevron size, m: across, how deep the V is, and how wide each arm is measured along the road. Deep, so it still reads as an arrow when seen low along the road. */
const HALF_WIDTH = 1.15;
const DEPTH = 1.5;
const ARM = 0.72;
/** Height above the asphalt: over the paint and the route ribbon. */
const LIFT = 0.05;
/** The prediction looks at most this far ahead in time, s: the next few seconds, as a driver plans. */
const HORIZON = 3;

/**
 * A flat chevron pointing +x, centered on the origin, 2.3 m across and
 * 1.5 m deep with arms about 0.45 m wide, big enough to read as an arrow
 * from a chase camera low behind the car. `grow` widens it all round, for the dark backing
 * that sits under the bright core.
 */
export function chevronGeometry(grow: number): THREE.BufferGeometry {
  const w = HALF_WIDTH + grow;
  const t = ARM + grow * 2;
  const tip = grow;
  const shape = new THREE.Shape();
  shape.moveTo(tip, 0);
  shape.lineTo(-DEPTH, w);
  shape.lineTo(-DEPTH - t, w);
  shape.lineTo(tip - t, 0);
  shape.lineTo(-DEPTH - t, -w);
  shape.lineTo(-DEPTH, -w);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate((DEPTH + ARM) / 2, LIFT, 0);
}

/** Poses along the predicted path, in sim meters and radians. */
export interface Prediction {
  count: number;
  x: Float64Array;
  y: Float64Array;
  heading: Float64Array;
}

/** What the prediction starts from: the followed SUV this frame. */
export interface PredictFrom {
  pos: { x: number; z: number };
  yaw: number;
  speed: number;
  steer: number;
  pedal: number;
}

const state = createCar(0, 0, 0);

/**
 * Runs the bicycle model forward from the SUV's pose with its current
 * steering and pedal, and records a pose every `spacing` meters of road
 * from `first` on, up to `count` of them. A car that would stop short gets
 * fewer marks. Allocation free.
 */
export function predictPath(from: PredictFrom, car: CarParams, first: number, spacing: number, count: number, out: Prediction): Prediction {
  const st = state;
  st.x = from.pos.x;
  st.y = -from.pos.z;
  st.heading = from.yaw;
  st.speed = from.speed;
  st.steer = from.steer;
  st.accelLong = 0;
  st.accelLat = 0;
  // The snapshot holds the wheel angle; undo the speed fade to get the command that produced it.
  const fade = from.speed / car.steerFadeSpeed;
  const steer = Math.max(-1, Math.min(1, (from.steer * (1 + fade * fade)) / car.steerMax));
  let travelled = 0;
  let next = first;
  let n = 0;
  for (let t = 0; t < HORIZON && n < count; t += SIM_DT) {
    const px = st.x;
    const py = st.y;
    const ph = st.heading;
    stepCar(st, steer, from.pedal, car);
    const step = Math.hypot(st.x - px, st.y - py);
    if (step < 1e-4 && st.speed < 0.05) break;
    while (n < count && travelled + step >= next) {
      const k = (next - travelled) / step;
      out.x[n] = px + (st.x - px) * k;
      out.y[n] = py + (st.y - py) * k;
      out.heading[n] = ph + Math.atan2(Math.sin(st.heading - ph), Math.cos(st.heading - ph)) * k;
      n++;
      next += spacing;
    }
    travelled += step;
  }
  out.count = n;
  return out;
}
