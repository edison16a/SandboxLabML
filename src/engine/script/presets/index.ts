import type { EnvId } from '../../env/types';
import { SCRIPT_ENV_TABLE } from '../envs';
import type { ScriptPreset } from './types';

export type { ScriptPreset };

/** Every preset of every environment, in the order of the script env table. */
export const SCRIPT_PRESETS: readonly ScriptPreset[] = SCRIPT_ENV_TABLE.flatMap((e) => e.presets);

/** Finds a preset of any environment by id. */
export function findScriptPreset(id: string): ScriptPreset | undefined {
  for (const e of SCRIPT_ENV_TABLE) for (const p of e.presets) if (p.id === id) return p;
  return undefined;
}

/** The read only scripts offered for one environment. */
export function presetsOf(env: EnvId): readonly ScriptPreset[] {
  return SCRIPT_ENV_TABLE.find((e) => e.env === env)?.presets ?? [];
}
