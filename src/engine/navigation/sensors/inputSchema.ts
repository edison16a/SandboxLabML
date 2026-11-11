import type { InputSpec, OutputSpec } from '../../env/types';
import { MAX_COURSE_LENGTH } from '../course/types';
import { DEFAULT_NAVIGATION_PARAMS, type NavigationParams } from '../params';
import { navigationInputCount, navRayAngles, type NavigationInputConfig } from './inputConfig';

/** A sensor declared by a script. Same shape as the other games', so the script compiler can pass any of them. */
export interface NavigationCustomSensor {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
}

function rayName(angle: number): string {
  const deg = Math.round((angle * 180) / Math.PI);
  if (deg === 0) return 'ahead';
  if (Math.abs(deg) === 180) return 'behind';
  return `${Math.abs(deg)}° ${deg > 0 ? 'left' : 'right'}`;
}

type Spec = Omit<InputSpec, 'index'>;

function scalar(key: string, label: string, unit: string, scale: number): Spec {
  return { key, label, group: 'scalar', unit, scale, offset: 0 };
}

/** Rays are keyed by angle, not position, so a fork that changes the ray count keeps the rays that did not move. */
function rayKey(angle: number): string {
  return `ray:${Math.round((angle * 1800) / Math.PI) / 10}`;
}

/**
 * The Navigation input schema for an input config. The inputs overlay, the
 * network graph labels and the observation builder all follow this exact
 * order, and a test checks the lengths agree.
 *
 * Labels stay within the 17 characters the network graph shows, so no two
 * inputs read the same there. Bearings and the side speed are positive to
 * the left.
 *
 * Order: ray distances, then (with hit types) one "spikes" flag per ray,
 * then one "mover" flag per ray, then goal, path hint, velocity and time,
 * then script sensors. Distances come first so a ray keeps its index when
 * hit types are switched on. Only distance inputs carry `ray` geometry.
 */
export function navigationInputSchema(cfg: NavigationInputConfig, params: NavigationParams = DEFAULT_NAVIGATION_PARAMS, custom: NavigationCustomSensor[] = []): InputSpec[] {
  const specs: Spec[] = [];
  const angles = navRayAngles(cfg.rays.count, cfg.rays.fov);
  const range = cfg.rays.range;
  for (const angle of angles) {
    specs.push({ key: rayKey(angle), label: `Ray ${rayName(angle)}`, group: 'ray', unit: 'm', scale: range, offset: 0, ray: { angle, maxLength: range } });
  }
  if (cfg.rays.hitTypes) {
    for (const angle of angles) specs.push({ key: `${rayKey(angle)}:spikes`, label: `Spikes ${rayName(angle)}`, group: 'ray', unit: '', scale: 1, offset: 0 });
    for (const angle of angles) specs.push({ key: `${rayKey(angle)}:mover`, label: `Mover ${rayName(angle)}`, group: 'ray', unit: '', scale: 1, offset: 0 });
  }
  if (cfg.goal) {
    specs.push(scalar('goalBearing', 'Finish bearing', 'rad', Math.PI));
    specs.push(scalar('goalDistance', 'Finish distance', 'm', MAX_COURSE_LENGTH));
  }
  if (cfg.pathHint) specs.push(scalar('pathHint', 'Path hint', 'rad', Math.PI));
  if (cfg.velocity) {
    specs.push(scalar('forwardSpeed', 'Forward speed', 'm/s', params.agent.maxSpeed));
    specs.push(scalar('sideSpeed', 'Side speed', 'm/s', params.agent.maxSpeed));
  }
  if (cfg.time) specs.push(scalar('timeLeft', 'Time left', '', 1));
  for (const c of custom) {
    specs.push({ key: `custom:${c.key}`, label: c.label, group: 'custom', unit: c.unit, scale: c.max - c.min, offset: c.min });
  }
  return specs.map((s, index) => ({ ...s, index }));
}

/** Brain outputs, in action order. Both are in [-1, 1]: move forward or back, turn left (positive) or right. */
export const NAVIGATION_OUTPUTS: OutputSpec[] = [
  { index: 0, key: 'move', label: 'Move' },
  { index: 1, key: 'turn', label: 'Turn' },
];

/** Total brain inputs: built in inputs plus script sensors. */
export function navigationBrainInputs(cfg: NavigationInputConfig, customCount = 0): number {
  return navigationInputCount(cfg) + customCount;
}
