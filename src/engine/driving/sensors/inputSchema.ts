import type { InputSpec, OutputSpec } from '../../env/types';
import type { CarParams } from '../car/params';
import {
  CURVE_FAR,
  CURVE_NEAR,
  CURVE_SCALE,
  DEST_RANGE,
  GAP_RANGE,
  lidarAngles,
  PED_LATERAL_SCALE,
  PED_RANGE,
  REL_SPEED_SCALE,
  STOP_RANGE,
  type DrivingInputConfig,
} from './inputConfig';

/** Custom sensor declared by a script, as the schema needs it. */
export interface CustomSensorSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
}

function beamLabel(angle: number, what: string): string {
  const deg = Math.round((angle * 180) / Math.PI);
  if (deg === 0) return `${what} ahead`;
  return `${what} ${Math.abs(deg)}° ${deg > 0 ? 'left' : 'right'}`;
}

/** Stable key for a beam, by angle, so a fork that changes the count keeps the beams that did not move. */
function beamKey(prefix: string, angle: number): string {
  return `${prefix}:${Math.round((angle * 1800) / Math.PI) / 10}`;
}

type Spec = Omit<InputSpec, 'index'>;
const scalar = (key: string, label: string, unit: string, scale: number, offset = 0): Spec => ({ key, label, group: 'scalar', unit, scale, offset });

/**
 * The driving input schema, generated from the run's input config. The
 * observation writer, the inputs panel, the network graph and the 3D
 * sensor overlay all follow this exact order; a test checks they agree.
 * Real value = normalized * scale + offset.
 */
export function drivingInputSchema(cfg: DrivingInputConfig, car: CarParams, custom: CustomSensorSpec[] = []): InputSpec[] {
  const specs: Spec[] = [];
  const angles = lidarAngles(cfg.lidar.count, cfg.lidar.fov);
  for (const angle of angles) {
    specs.push({ key: beamKey('lidar', angle), label: beamLabel(angle, 'Lidar'), group: 'ray', unit: 'm', scale: cfg.lidar.range, offset: 0, ray: { angle, maxLength: cfg.lidar.range } });
  }
  // What each beam hit: 0 nothing, 1/3 a curb or wall, 2/3 a car, 1 a person.
  if (cfg.lidarKinds) for (const angle of angles) specs.push(scalar(beamKey('lidarKind', angle), beamLabel(angle, 'Hit type'), '', 3));
  if (cfg.lane) {
    specs.push(scalar('laneOffset', 'Lane offset', 'm', 3.5));
    specs.push(scalar('headingError', 'Heading error', 'rad', Math.PI / 2));
    specs.push(scalar('aim', 'Path ahead', 'rad', Math.PI / 2));
    specs.push(scalar('curveNear', `Curve at ${CURVE_NEAR} m`, '1/m', CURVE_SCALE));
    specs.push(scalar('curveFar', `Curve at ${CURVE_FAR} m`, '1/m', CURVE_SCALE));
  }
  if (cfg.route) {
    specs.push(scalar('nextTurn', 'Next turn', '', 1));
    specs.push(scalar('turnDistance', 'Next turn in', 'm', STOP_RANGE));
    specs.push(scalar('destination', 'Destination', 'm', DEST_RANGE));
  }
  if (cfg.light) {
    specs.push(scalar('light', 'Light ahead', '', 2));
    specs.push(scalar('lightDistance', 'Light distance', 'm', STOP_RANGE));
  }
  if (cfg.carAhead) {
    specs.push(scalar('carGap', 'Car ahead', 'm', GAP_RANGE));
    specs.push(scalar('carRelSpeed', 'Car ahead speed', 'm/s', REL_SPEED_SCALE));
  }
  if (cfg.pedestrian) {
    specs.push(scalar('pedDistance', 'Person ahead', 'm', PED_RANGE));
    specs.push(scalar('pedLateral', 'Person offset', 'm', PED_LATERAL_SCALE));
  }
  if (cfg.speed) {
    specs.push(scalar('speed', 'Speed', 'm/s', car.topSpeed));
    specs.push(scalar('speedLimit', 'Speed limit', 'm/s', car.topSpeed));
  }
  for (const c of custom) specs.push({ key: `custom:${c.key}`, label: c.label, group: 'custom', unit: c.unit, scale: c.max - c.min, offset: c.min });
  return specs.map((s, index) => ({ ...s, index }));
}

export const DRIVING_OUTPUTS: OutputSpec[] = [
  { index: 0, key: 'steer', label: 'Steer' },
  { index: 1, key: 'pedal', label: 'Pedal' },
];

/** How many built in inputs a config gives, before any script sensors. */
export function builtInInputCount(cfg: DrivingInputConfig): number {
  const groups = [cfg.lane ? 5 : 0, cfg.route ? 3 : 0, cfg.light ? 2 : 0, cfg.carAhead ? 2 : 0, cfg.pedestrian ? 2 : 0, cfg.speed ? 2 : 0];
  return cfg.lidar.count * (cfg.lidarKinds ? 2 : 1) + groups.reduce((a, b) => a + b, 0);
}
