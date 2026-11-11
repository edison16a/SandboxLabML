import { reasonCode, type DrivingLearner } from './agent/learner';
import { MAX_PEDS, MAX_TRAFFIC, type WorldState } from './world/state';
import { LF_BRAKE, LF_LANE, LF_LEFT, LF_RAN_RED, LF_RIGHT, LF_SPEEDING, LF_WAITING, LF_WRONG_WAY } from './snapshotLayout';

export * from './snapshotLayout';

export function learnerFlags(l: DrivingLearner): number {
  let f = l.car.pedal < -0.05 || (l.car.speed < 0.3 && l.status === 0) ? LF_BRAKE : 0;
  // Indicate over the 30 m before a turn and through it.
  const turnSoon = l.turnDistance < 30;
  if (turnSoon && l.nextTurn === -1) f |= LF_LEFT;
  if (turnSoon && l.nextTurn === 1) f |= LF_RIGHT;
  if (l.laneDeparture) f |= LF_LANE;
  if (l.wrongWay) f |= LF_WRONG_WAY;
  if (l.speeding) f |= LF_SPEEDING;
  if (l.redLightRuns > 0) f |= LF_RAN_RED;
  if (l.waiting) f |= LF_WAITING;
  return f;
}

export function writeLearner(l: DrivingLearner, out: Float32Array, o: number): void {
  out[o] = l.car.x;
  out[o + 1] = l.car.y;
  out[o + 2] = l.car.heading;
  out[o + 3] = l.car.speed;
  out[o + 4] = l.car.steer;
  out[o + 5] = l.car.pedal;
  out[o + 6] = l.status;
  out[o + 7] = l.progress;
  out[o + 8] = learnerFlags(l);
  out[o + 9] = reasonCode(l.stopReason);
}

/**
 * The world snapshot: a header, then fixed size blocks for signals, other
 * cars and people, so a reader finds any field by offset alone.
 *
 * header: time, signal count, car count, person count, signals on (1/0), level, trip, trips
 * (the trip slots are 0 here; a generation of several trips fills them, see run/tripHeader.ts)
 * signal: light for east, north, west and south bound traffic (-1 no street), walk with north south, walk with east west
 * car: x, y, heading, kind, speed, flags, length, width
 * person: x, y, heading, walk phase, state, look
 */
export const DRIVING_WORLD = {
  header: 8,
  signalStride: 6,
  carStride: 8,
  pedStride: 6,
  maxSignals: 64,
  maxCars: MAX_TRAFFIC,
  maxPeds: MAX_PEDS,
} as const;

export const WORLD_SIGNALS = DRIVING_WORLD.header;
export const WORLD_CARS = WORLD_SIGNALS + DRIVING_WORLD.maxSignals * DRIVING_WORLD.signalStride;
export const WORLD_PEDS = WORLD_CARS + DRIVING_WORLD.maxCars * DRIVING_WORLD.carStride;
/** Floats in one world snapshot. */
export const WORLD_SIZE = WORLD_PEDS + DRIVING_WORLD.maxPeds * DRIVING_WORLD.pedStride;

export function writeWorld(state: WorldState, level: number, out: Float32Array, offset = 0): void {
  const signals = Math.min(DRIVING_WORLD.maxSignals, state.lights.length / 4);
  out[offset] = state.time;
  out[offset + 1] = signals;
  out[offset + 2] = state.carCount;
  out[offset + 3] = state.pedCount;
  out[offset + 4] = state.signalsOn ? 1 : 0;
  out[offset + 5] = level;
  for (let k = 0; k < signals; k++) {
    const o = offset + WORLD_SIGNALS + k * DRIVING_WORLD.signalStride;
    for (let d = 0; d < 4; d++) out[o + d] = state.lights[k * 4 + d];
    out[o + 4] = state.walks[k * 2];
    out[o + 5] = state.walks[k * 2 + 1];
  }
  for (let i = 0; i < state.carCount; i++) {
    const o = offset + WORLD_CARS + i * DRIVING_WORLD.carStride;
    out[o] = state.carX[i];
    out[o + 1] = state.carY[i];
    out[o + 2] = state.carHeading[i];
    out[o + 3] = state.carKind[i];
    out[o + 4] = state.carSpeed[i];
    out[o + 5] = state.carFlags[i];
    out[o + 6] = state.carLength[i];
    out[o + 7] = state.carWidth[i];
  }
  for (let i = 0; i < state.pedCount; i++) {
    const o = offset + WORLD_PEDS + i * DRIVING_WORLD.pedStride;
    out[o] = state.pedX[i];
    out[o + 1] = state.pedY[i];
    out[o + 2] = state.pedHeading[i];
    out[o + 3] = state.pedPhase[i];
    out[o + 4] = state.pedState[i];
    out[o + 5] = state.pedLook[i];
  }
}

/** Decodes a world snapshot back into a WorldState, for the renderer and replays. */
export function readWorld(buf: Float32Array, state: WorldState, offset = 0): void {
  state.time = buf[offset];
  const signals = Math.min(buf[offset + 1], state.lights.length / 4);
  state.carCount = Math.min(buf[offset + 2], MAX_TRAFFIC);
  state.pedCount = Math.min(buf[offset + 3], MAX_PEDS);
  state.signalsOn = buf[offset + 4] > 0.5;
  for (let k = 0; k < signals; k++) {
    const o = offset + WORLD_SIGNALS + k * DRIVING_WORLD.signalStride;
    for (let d = 0; d < 4; d++) state.lights[k * 4 + d] = buf[o + d];
    state.walks[k * 2] = buf[o + 4];
    state.walks[k * 2 + 1] = buf[o + 5];
  }
  for (let i = 0; i < state.carCount; i++) {
    const o = offset + WORLD_CARS + i * DRIVING_WORLD.carStride;
    state.carX[i] = buf[o];
    state.carY[i] = buf[o + 1];
    state.carHeading[i] = buf[o + 2];
    state.carKind[i] = buf[o + 3];
    state.carSpeed[i] = buf[o + 4];
    state.carFlags[i] = buf[o + 5];
    state.carLength[i] = buf[o + 6];
    state.carWidth[i] = buf[o + 7];
  }
  for (let i = 0; i < state.pedCount; i++) {
    const o = offset + WORLD_PEDS + i * DRIVING_WORLD.pedStride;
    state.pedX[i] = buf[o];
    state.pedY[i] = buf[o + 1];
    state.pedHeading[i] = buf[o + 2];
    state.pedPhase[i] = buf[o + 3];
    state.pedState[i] = buf[o + 4];
    state.pedLook[i] = buf[o + 5];
  }
}
