import { hashObject } from '../core/hash';
import type { EpisodeEnvInfo } from '../env/episode';
import { NAVIGATION_ENGINE_VERSION, navigationParamsHash } from './params';
import { NAVIGATION_BLUEPRINTS, validateNavigationInputs } from './pipeline/blueprints';
import { NAVIGATION_METRICS } from './pipeline/metricSpecs';
import { navigationOf } from './pipeline/settings';
import { navigationInputCount, type NavigationInputConfig } from './sensors/inputConfig';
import { NAVIGATION_OUTPUTS, navigationInputSchema } from './sensors/inputSchema';
import { NAVIGATION_SNAPSHOT } from './snapshot';

/**
 * Navigation's light half: labels, layouts, brains, metrics and the input
 * schema. It stays clear of the courses and the kinematics, which the
 * module adds, so the Runs page and the Studio never ship them.
 */
export const navigationInfo = {
  id: 'navigation' as const,
  label: 'Navigation',
  engineVersion: NAVIGATION_ENGINE_VERSION,
  tickHz: 30,
  snapshot: NAVIGATION_SNAPSHOT,
  outputs: NAVIGATION_OUTPUTS,
  metrics: NAVIGATION_METRICS,

  blueprints: NAVIGATION_BLUEPRINTS,
  inputCount: (inputs) => navigationInputCount(inputs as NavigationInputConfig),
  validateInputs: validateNavigationInputs,
  inputSchema: (config, custom = []) => {
    const { settings, inputs } = navigationOf(config);
    return navigationInputSchema(inputs, settings.params, [...custom]);
  },
  physicsHash: (config) => {
    const { settings, inputs } = navigationOf(config);
    return hashObject({ rules: navigationParamsHash(settings.params), inputs });
  },

  load: () => import('./module').then((m) => m.navigationModule),
} satisfies EpisodeEnvInfo;
