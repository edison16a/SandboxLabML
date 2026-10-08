import type { InputSpec, OutputSpec } from '../../env/types';
import { hideSeekInputCount, type HideSeekInputConfig } from '../inputConfig';
import { DEFAULT_HIDESEEK_PHYSICS, type HideSeekPhysics } from '../physics';
import { hideSeekRayAngles } from './rays';

/** A sensor declared by a script. Same shape as Racing's, so the script compiler can pass either. */
export interface HideSeekCustomSensor {
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

/**
 * The Hide and Seek input schema for one team's input config. The inputs
 * overlay, the network graph labels and the observation builder all follow
 * this exact order, and a test checks the lengths agree.
 *
 * Order: ray distances, then (with hit types) one "box" flag per ray, then
 * one "agent" flag per ray, then the scalars, then the nearest boxes, then
 * the ramp group, then script sensors. Keeping distances first means a ray
 * keeps its index when hit types are switched on. Only distance inputs
 * carry `ray` geometry; the hit flags belong to the ray group but have
 * none. A ray's "box" flag is on for crates and ramps alike.
 *
 * Nearest boxes and the ramp are given in the agent frame: the world frame
 * turned with the agent, so x points ahead and z points to the agent's
 * right.
 */
export function hideSeekInputSchema(
  cfg: HideSeekInputConfig,
  physics: HideSeekPhysics = DEFAULT_HIDESEEK_PHYSICS,
  custom: HideSeekCustomSensor[] = [],
): InputSpec[] {
  const specs: Spec[] = [];
  const angles = hideSeekRayAngles(cfg.rays.count);
  const range = cfg.rays.range;
  angles.forEach((angle, i) => {
    specs.push({ key: `ray:${i}`, label: `Ray ${rayName(angle)}`, group: 'ray', unit: 'm', scale: range, offset: 0, ray: { angle, maxLength: range } });
  });
  if (cfg.rays.hitTypes) {
    angles.forEach((angle, i) => specs.push({ key: `ray:${i}:box`, label: `Box on ray ${rayName(angle)}`, group: 'ray', unit: '', scale: 1, offset: 0 }));
    angles.forEach((angle, i) => specs.push({ key: `ray:${i}:agent`, label: `Agent on ray ${rayName(angle)}`, group: 'ray', unit: '', scale: 1, offset: 0 }));
  }
  const top = physics.agent.maxSpeed;
  if (cfg.velocity) {
    specs.push(scalar('forwardSpeed', 'Forward speed', 'm/s', top));
    specs.push(scalar('sideSpeed', 'Sideways speed (left)', 'm/s', top));
  } else if (cfg.speed) {
    specs.push(scalar('speed', 'Speed', 'm/s', top));
  }
  if (cfg.holding) specs.push(scalar('holding', 'Holding a box', '', 1));
  if (cfg.phase) specs.push(scalar('phase', 'Prep phase', '', 1));
  if (cfg.time) specs.push(scalar('timeLeft', 'Time left', 's', physics.matchSeconds));
  if (cfg.opponentVisible) specs.push(scalar('opponentVisible', 'Opponent in sight', '', 1));
  if (cfg.opponentLastSeen) specs.push(scalar('opponentLastSeen', 'Bearing to last sighting', 'rad', Math.PI));
  const size = physics.arena.size;
  for (let k = 1; k <= cfg.nearestBoxes; k++) {
    specs.push(scalar(`box:${k}:ahead`, `Box ${k} ahead`, 'm', size));
    specs.push(scalar(`box:${k}:right`, `Box ${k} to the right`, 'm', size));
    specs.push(scalar(`box:${k}:distance`, `Box ${k} distance`, 'm', size));
    specs.push(scalar(`box:${k}:locked`, `Box ${k} locked`, '', 1));
  }
  if (cfg.ramp) {
    specs.push(scalar('ramp:ahead', 'Ramp ahead', 'm', size));
    specs.push(scalar('ramp:right', 'Ramp to the right', 'm', size));
    specs.push(scalar('ramp:distance', 'Ramp distance', 'm', size));
    specs.push(scalar('ramp:uphill', 'Facing up the ramp', '', 1));
    specs.push(scalar('ramp:lock', 'Ramp lock (us +1, them -1)', '', 1));
    specs.push(scalar('ramp:elevation', 'Own elevation', 'm', physics.box.ramp.height));
  }
  for (const c of custom) {
    specs.push({ key: `custom:${c.key}`, label: c.label, group: 'custom', unit: c.unit, scale: c.max - c.min, offset: c.min });
  }
  return specs.map((s, index) => ({ ...s, index }));
}

/** Brain outputs, in action order. Each is in [-1, 1]; grab and lock count as on above zero. */
export const HIDESEEK_OUTPUTS: OutputSpec[] = [
  { index: 0, key: 'move', label: 'Move' },
  { index: 1, key: 'turn', label: 'Turn' },
  { index: 2, key: 'grab', label: 'Grab' },
  { index: 3, key: 'lock', label: 'Lock' },
];

/** Total brain inputs for a team: built-in inputs plus script sensors. */
export function hideSeekBrainInputs(cfg: HideSeekInputConfig, customCount = 0): number {
  return hideSeekInputCount(cfg) + customCount;
}
