import type { ReferenceTier } from '@/engine/bench/types';
import { presetsOf } from '@/engine/script/presets';
import type { RunConfig } from '@/engine/training/runConfig';
import { scriptName } from '@/features/scripts/runScript';

/**
 * The reference script a run's benchmark is best read against: the preset
 * its script is now. It is found by the name in the script's header, so a
 * run made before a preset's comments changed still finds it. The built-in
 * reward is Intermediate's, since that preset writes it out line for line.
 * A script of the user's own matches none.
 */
export function matchingTier(run: RunConfig | null): ReferenceTier | null {
  if (!run) return null;
  const script = run.scripts.at(-1);
  if (!script) return 'intermediate';
  const name = scriptName(script.source);
  return presetsOf(run.env).find((p) => scriptName(p.source) === name)?.tier ?? null;
}
