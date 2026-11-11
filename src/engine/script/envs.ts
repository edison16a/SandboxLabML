import type { EnvId } from '../env/types';
import { HIDESEEK_PRESETS } from './presets/hideseek';
import { RACING_PRESETS } from './presets/racing';
import type { ScriptPreset } from './presets/types';
import { HIDESEEK_SLICE } from './registry/hideseek';
import { RACING_SLICE } from './registry/racing';
import type { RegistrySlice } from './registry/types';

/** The script layer's part of one env: what its scripts may use and the scripts it ships. */
export interface ScriptEnv {
  env: EnvId;
  /** Sensors, actions and operators a `for <env> v1` script can name. */
  slice: RegistrySlice;
  /** Read only scripts for the picker and Studio, one per tier. */
  presets: readonly ScriptPreset[];
  /** What a run without a script trains on, in one line for the script picker. */
  builtin: string;
  /** The source a new Studio script starts from. It should compile and run as it is. */
  starter: string;
}

/**
 * Every env a script header may name. This is the one entry a new env
 * adds to the script layer: the checker, compiler, docs, block palette,
 * autocomplete and preset lists all read it.
 */
export const SCRIPT_ENV_TABLE: readonly ScriptEnv[] = [
  {
    env: 'racing',
    slice: RACING_SLICE,
    presets: RACING_PRESETS,
    builtin: 'Checkpoints, laps and a little speed.',
    starter: [
      'script "My script" for racing v1',
      'brain racing-standard',
      '',
      'each tick {',
      '  drive(steer: brain.steer, pedal: brain.pedal)',
      '  reward +1 when checkpoint.passed',
      '  stop "crash" when car.offTrack',
      '}',
      '',
    ].join('\n'),
  },
  {
    env: 'hideseek',
    slice: HIDESEEK_SLICE,
    presets: HIDESEEK_PRESETS,
    builtin: 'Hiders score while unseen, seekers while they see.',
    starter: 'script "My script" for hideseek v1\n\n// Hide and Seek scripts are coming soon. Sketch your ideas here.\n',
  },
];

/** The env the Studio assumes for a script without a valid header, and offers first. */
export const DEFAULT_SCRIPT_ENV: EnvId = SCRIPT_ENV_TABLE[0].env;

export function scriptEnv(env: string): ScriptEnv | undefined {
  return SCRIPT_ENV_TABLE.find((e) => e.env === env);
}
