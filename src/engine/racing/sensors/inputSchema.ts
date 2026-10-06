import type { InputSpec, OutputSpec } from '../../env/types';
import type { CarParams } from '../car/params';
import { CURVATURE_FAR, CURVATURE_NEAR, CURVATURE_SCALE, rayAngles, type RacingInputConfig } from './inputConfig';

/** Custom sensor declared by a script, as the schema needs it. */
export interface CustomSensorSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
}

function rayLabel(angle: number): string {
  const deg = Math.round((angle * 180) / Math.PI);
  if (deg === 0) return 'Ray ahead';
  return `Ray ${Math.abs(deg)}° ${deg > 0 ? 'left' : 'right'}`;
}

/**
 * The racing input schema, generated from the run's input config. The inputs
 * overlay, the network graph labels and the observation builder all follow
 * this exact order, and a test checks the lengths agree.
 */
export function racingInputSchema(cfg: RacingInputConfig, car: CarParams, custom: CustomSensorSpec[] = []): InputSpec[] {
  const specs: Omit<InputSpec, 'index'>[] = [];
  for (const [i, angle] of rayAngles(cfg.rays.count, cfg.rays.fov).entries()) {
    specs.push({
      key: `ray:${i}`,
      label: rayLabel(angle),
      group: 'ray',
      unit: 'm',
      scale: cfg.rays.range,
      offset: 0,
      ray: { angle, maxLength: cfg.rays.range },
    });
  }
  if (cfg.speed) specs.push({ key: 'speed', label: 'Speed', group: 'scalar', unit: 'm/s', scale: car.topSpeed, offset: 0 });
  if (cfg.headingError) specs.push({ key: 'headingError', label: 'Heading error', group: 'scalar', unit: 'rad', scale: Math.PI, offset: 0 });
  if (cfg.steerAngle) specs.push({ key: 'steerAngle', label: 'Steering angle', group: 'scalar', unit: 'rad', scale: car.steerMax, offset: 0 });
  if (cfg.curvatureNear) specs.push({ key: 'curvatureNear', label: `Curve at ${CURVATURE_NEAR} m`, group: 'scalar', unit: '1/m', scale: CURVATURE_SCALE, offset: 0 });
  if (cfg.curvatureFar) specs.push({ key: 'curvatureFar', label: `Curve at ${CURVATURE_FAR} m`, group: 'scalar', unit: '1/m', scale: CURVATURE_SCALE, offset: 0 });
  if (cfg.slip) specs.push({ key: 'slip', label: 'Lateral slip', group: 'scalar', unit: '', scale: 1, offset: 0 });
  for (const c of custom) {
    specs.push({ key: `custom:${c.key}`, label: c.label, group: 'custom', unit: c.unit, scale: c.max - c.min, offset: c.min });
  }
  return specs.map((s, index) => ({ ...s, index }));
}

export const RACING_OUTPUTS: OutputSpec[] = [
  { index: 0, key: 'steer', label: 'Steer' },
  { index: 1, key: 'pedal', label: 'Pedal' },
];

export function builtInInputCount(cfg: RacingInputConfig): number {
  return (
    cfg.rays.count +
    [cfg.speed, cfg.headingError, cfg.steerAngle, cfg.curvatureNear, cfg.curvatureFar, cfg.slip].filter(Boolean).length
  );
}
