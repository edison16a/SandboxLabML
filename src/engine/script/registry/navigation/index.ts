import type { RegistrySlice } from '../types';
import { NAVIGATION_ACTION_ENTRIES } from './actions';
import { NAVIGATION_AGENT_ENTRIES } from './agent';
import { NAVIGATION_HAZARD_ENTRIES } from './hazards';
import { NAVIGATION_GENERATION_ENTRIES } from './operators';
import { runner } from './sensor';

/** Everything a `for navigation v1` script can read, call and do. */
export const NAVIGATION_SLICE: RegistrySlice = {
  env: 'navigation',
  entries: [...NAVIGATION_AGENT_ENTRIES, ...NAVIGATION_HAZARD_ENTRIES, ...NAVIGATION_ACTION_ENTRIES, ...NAVIGATION_GENERATION_ENTRIES],
  agentSeed: (v) => runner(v).seed,
};
