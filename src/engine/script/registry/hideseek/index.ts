import type { RegistrySlice } from '../types';
import { HIDESEEK_ACTION_ENTRIES } from './actions';
import { HIDESEEK_AGENT_ENTRIES } from './agent';
import { HIDESEEK_BOX_ENTRIES } from './boxes';
import { HIDESEEK_OPERATOR_ENTRIES } from './operators';
import { HIDESEEK_RAY_ENTRIES } from './rays';
import { agent } from './sensor';
import { HIDESEEK_SIGHT_ENTRIES } from './sight';

/**
 * Everything a Hide and Seek script can read, call and do. One script
 * drives both teams: its each tick block runs for hiders and seekers alike
 * and tells them apart with agent.isHider, and its each generation block
 * runs once per team.
 */
export const HIDESEEK_SLICE: RegistrySlice = {
  env: 'hideseek',
  entries: [
    ...HIDESEEK_AGENT_ENTRIES,
    ...HIDESEEK_SIGHT_ENTRIES,
    ...HIDESEEK_BOX_ENTRIES,
    ...HIDESEEK_RAY_ENTRIES,
    ...HIDESEEK_ACTION_ENTRIES,
    ...HIDESEEK_OPERATOR_ENTRIES,
  ],
  // The team slot is stable for a match, so each team's rand() stream is the same in training and in a replay.
  agentSeed: (v) => agent(v).index + 1,
};
