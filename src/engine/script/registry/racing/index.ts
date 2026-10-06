import type { RegistrySlice } from '../types';
import { RACING_ACTION_ENTRIES } from './actions';
import { RACING_CAR_ENTRIES } from './car';
import { RACING_PROGRESS_ENTRIES } from './progress';
import { car } from './sensor';
import { RACING_TRACK_ENTRIES } from './track';

/** Everything a racing script can read, call and do. */
export const RACING_SLICE: RegistrySlice = {
  env: 'racing',
  entries: [...RACING_CAR_ENTRIES, ...RACING_PROGRESS_ENTRIES, ...RACING_TRACK_ENTRIES, ...RACING_ACTION_ENTRIES],
  agentSeed: (v) => car(v).seed,
};
