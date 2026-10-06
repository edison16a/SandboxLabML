import type { EnvId } from '../../env/types';
import type { PresetTier } from '../registry/types';

/** A ready-made script shown in the script picker. Presets are read only, and editing one makes a copy. */
export interface ScriptPreset {
  id: string;
  name: string;
  tier: PresetTier;
  env: EnvId;
  description: string;
  source: string;
}
