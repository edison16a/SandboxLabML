import { clamp } from '../../core/math';
import { GRAVITY, SIM_DT, SUBSTEPS, type CarParams } from './params';

/** Everything the physics needs about one car, plus cosmetic outputs for the renderer. */
export interface CarState {
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Front wheel angle, rad. */
  steer: number;
  /** Last applied controls, kept for brake lights and the inputs overlay. */
  steerCmd: number;
  pedal: number;
  /** Longitudinal and lateral acceleration, for body pitch, roll and the grip readout. */
  accelLong: number;
  accelLat: number;
  /** Share of the commanded turn the tires could not deliver, 0..1. */
  slip: number;
}

export function createCar(x: number, y: number, heading: number): CarState {
  return { x, y, heading, speed: 0, steer: 0, steerCmd: 0, pedal: 0, accelLong: 0, accelLat: 0, slip: 0 };
}

/**
 * Advances one car by one 1/30 s tick using a kinematic bicycle model with a
 * friction-circle grip limit. Braking and turning share the same grip, so
 * the fast way through a corner is to brake in a straight line, then turn.
 *
 * `steer` and `pedal` are in [-1, 1]. Positive pedal is throttle, negative
 * is brake. Fully deterministic: no randomness and a fixed operation order.
 */
export function stepCar(car: CarState, steerIn: number, pedalIn: number, p: CarParams): void {
  const steerCmd = clamp(Number.isFinite(steerIn) ? steerIn : 0, -1, 1);
  const pedal = clamp(Number.isFinite(pedalIn) ? pedalIn : 0, -1, 1);
  car.steerCmd = steerCmd;
  car.pedal = pedal;
  const h = SIM_DT / SUBSTEPS;
  const muG = p.grip * GRAVITY;
  let slipSum = 0;
  let latSum = 0;
  let longSum = 0;

  for (let k = 0; k < SUBSTEPS; k++) {
    const v = car.speed;
    // Steering: target angle shrinks with speed and the wheel turns at a limited rate.
    const fade = v / p.steerFadeSpeed;
    const target = (steerCmd * p.steerMax) / (1 + fade * fade);
    const maxDelta = p.steerRate * h;
    car.steer += clamp(target - car.steer, -maxDelta, maxDelta);
    const kappa = Math.tan(car.steer) / p.wheelbase;

    // Longitudinal. Full brake asks for exactly `brake` m/s^2 of deceleration,
    // with drag counted as part of it, like a brake-by-wire controller.
    const drag = v > 0 ? p.rollingDrag + p.airDrag * v * v : 0;
    let aLong: number;
    if (pedal < 0) aLong = v > 0 ? -Math.max(-pedal * p.brake, drag) : 0;
    else aLong = pedal * p.accel * (1 - v / p.topSpeed) - drag;
    aLong = clamp(aLong, -muG, muG);

    // Friction circle: whatever grip braking or accelerating uses is gone for turning.
    const latMax = Math.sqrt(Math.max(0, muG * muG - aLong * aLong));
    let kappaEff = kappa;
    let excess = 0;
    // Use the faster of the start and end speed so the limit holds over the whole substep.
    const vRef = Math.max(v, v + aLong * h);
    if (vRef > 0.5) {
      const kMax = latMax / (vRef * vRef);
      if (Math.abs(kappa) > kMax) {
        kappaEff = Math.sign(kappa) * kMax;
        excess = (Math.abs(kappa) - kMax) * vRef * vRef;
      }
    }
    const slip = Math.abs(kappa) > 1e-6 ? 1 - kappaEff / kappa : 0;

    let nextV = v + aLong * h - p.scrub * excess * h;
    if (nextV < 0) nextV = 0;
    const vAvg = (v + nextV) / 2;
    car.heading += vAvg * kappaEff * h;
    car.x += vAvg * Math.cos(car.heading) * h;
    car.y += vAvg * Math.sin(car.heading) * h;
    car.speed = nextV;

    slipSum += slip;
    latSum += vAvg * vAvg * kappaEff;
    longSum += (nextV - v) / h;
  }
  car.slip = slipSum / SUBSTEPS;
  car.accelLat = latSum / SUBSTEPS;
  car.accelLong = longSum / SUBSTEPS;
}
