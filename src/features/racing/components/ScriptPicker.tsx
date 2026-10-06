'use client';

import type { RacingBlueprint } from '@/engine/blueprints/types';

/** The reward the run trains with: the built-in reward or a compiled SBL script. */
export type ScriptChoice =
  | { kind: 'builtin' }
  | { kind: 'script'; id: string; name: string; compiled: { source: string; hash: string; customSensors: number }; blueprint?: RacingBlueprint };

/**
 * Picks the training script for a new run. Until the script engine is
 * available this only offers the built-in reward.
 */
export function ScriptPicker({ value }: { value: ScriptChoice; onChange: (v: ScriptChoice) => void }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
      Training script: <span className="text-fg">{value.kind === 'builtin' ? 'Built-in reward' : value.name}</span>
    </div>
  );
}
