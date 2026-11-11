import type { RegistrySlice } from '../types';
import { DRIVING_ACTION_ENTRIES } from './actions';
import { DRIVING_CAR_ENTRIES } from './car';
import { DRIVING_GENERATION_ENTRIES } from './operators';
import { DRIVING_RULE_ENTRIES } from './rules';
import { learner } from './sensor';

/**
 * Everything a `for driving v1` script can read, call and do: the SUV and
 * its trip, the rules of the road, the brain's outputs, and the generation
 * block's levels, trips and cities.
 */
export const DRIVING_SLICE: RegistrySlice = {
  env: 'driving',
  entries: [...DRIVING_CAR_ENTRIES, ...DRIVING_RULE_ENTRIES, ...DRIVING_ACTION_ENTRIES, ...DRIVING_GENERATION_ENTRIES],
  agentSeed: (v) => learner(v).seed,
};
