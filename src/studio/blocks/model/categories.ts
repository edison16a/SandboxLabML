import type { EnvId } from '@/engine/env/types';
import { entriesByName, type BlockCategory, type ScriptBlock } from '@/engine/script';

/**
 * Rail colors by category. Most come straight from the theme tokens; math
 * and the two generation categories need hues of their own, picked to sit
 * quietly next to the token colors.
 */
export const CATEGORY_COLORS: Record<BlockCategory | 'section', string> = {
  sensors: 'var(--color-accent)',
  actions: 'var(--color-success)',
  rewards: 'var(--color-orange)',
  logic: 'var(--color-warn)',
  math: 'var(--color-muted)',
  evolution: '#b48cff',
  environment: '#36c5c0',
  section: 'var(--color-border-strong)',
};

/** The category a statement belongs to, which picks its rail color and palette group. */
export function categoryOf(b: ScriptBlock, env: EnvId | null): BlockCategory | 'section' {
  switch (b.type) {
    case 'reward':
    case 'stop':
      return 'rewards';
    case 'sensor':
      return 'sensors';
    case 'each':
      return 'section';
    case 'call':
    case 'callValue':
      return entriesByName(env).get(String(b.fields.name))?.block.category ?? 'actions';
    default:
      return 'logic';
  }
}

/** A short accessible name for a block, such as "reward block". */
export function blockTitle(b: ScriptBlock): string {
  if (b.type === 'call') return `${String(b.fields.name)} block`;
  if (b.type === 'forEach') return 'for each block';
  if (b.type === 'each') return `each ${String(b.fields.event)} section`;
  return `${b.type} block`;
}
