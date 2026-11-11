import { BLUEPRINT_SCHEMA_VERSION, type BlueprintIssue, type EpisodeBlueprint } from '../../blueprints/types';
import { STANDARD_NAVIGATION_INPUTS, type NavigationInputConfig } from '../sensors/inputConfig';

/** A Navigation brain: its sensor groups are the env's own input config. */
export type NavigationBlueprint = EpisodeBlueprint<'navigation', NavigationInputConfig>;

const base = { schemaVersion: BLUEPRINT_SCHEMA_VERSION, readonly: true, activation: 'tanh', wiring: 'direct', env: 'navigation' } as const;

/**
 * The Navigation preset brains, simplest first. Starter sees walls and the
 * way to go, Standard adds what each ray hit plus its own speed and clock,
 * and Advanced trades the path hint for more rays, so it has to find the
 * way round obstacles on its own.
 */
export const NAVIGATION_BLUEPRINTS: NavigationBlueprint[] = [
  {
    ...base,
    id: 'navigation-starter',
    name: 'Navigation Starter',
    tier: 'starter',
    description: 'Eight rays, the finish and the path hint. 11 inputs.',
    teaches: 'Running to the line and round crates.',
    inputs: { ...STANDARD_NAVIGATION_INPUTS, rays: { count: 8, fov: 2 * Math.PI, range: 8, hitTypes: false }, velocity: false, time: false },
  },
  {
    ...base,
    id: 'navigation-standard',
    name: 'Navigation Standard',
    tier: 'standard',
    description: 'Twelve rays that tell walls, spikes and movers apart, the finish, the path hint, speed and time. 42 inputs.',
    teaches: 'Every level, spikes and movers included.',
    inputs: STANDARD_NAVIGATION_INPUTS,
  },
  {
    ...base,
    id: 'navigation-advanced',
    name: 'Navigation Advanced',
    tier: 'advanced',
    description: 'Sixteen rays with hit types, the finish, speed and time, and no path hint. 53 inputs.',
    teaches: 'Finding the way round walls without being shown it.',
    inputs: { ...STANDARD_NAVIGATION_INPUTS, rays: { count: 16, fov: 2 * Math.PI, range: 12, hitTypes: true }, pathHint: false },
  },
];

const RAYS = [4, 24] as const;
const RANGE = [2, 20] as const;

/** Problems with a Navigation sensor config, for the blueprint form and imports. Noise is checked for every env elsewhere. */
export function validateNavigationInputs(value: unknown): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  const inputs = value as Partial<NavigationInputConfig> | null;
  const rays = inputs?.rays;
  if (!rays || !Number.isInteger(rays.count) || rays.count < RAYS[0] || rays.count > RAYS[1]) {
    issues.push({ field: 'rays', message: `Use between ${RAYS[0]} and ${RAYS[1]} rays.` });
  }
  if (!rays || typeof rays.range !== 'number' || !(rays.range >= RANGE[0] && rays.range <= RANGE[1])) {
    issues.push({ field: 'rays', message: `Ray range must be between ${RANGE[0]} and ${RANGE[1]} m.` });
  }
  if (!rays || typeof rays.fov !== 'number' || !(rays.fov > 0 && rays.fov <= 2 * Math.PI + 1e-9)) {
    issues.push({ field: 'rays', message: 'The field of view must be more than 0 and at most a full turn.' });
  }
  if (!rays || typeof rays.hitTypes !== 'boolean') issues.push({ field: 'rays', message: 'Say whether rays tell what they hit.' });
  for (const key of ['goal', 'pathHint', 'velocity', 'time'] as const) {
    if (typeof inputs?.[key] !== 'boolean') issues.push({ field: key, message: `Say whether the brain gets ${key}.` });
  }
  return issues;
}
