import type { GenerationRecord } from '@/engine/training/records';
import { scriptAt, type RunConfig } from '@/engine/training/runConfig';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';

/** How the user picks which past champions appear as ghosts. */
export type GhostSelection =
  | { mode: 'auto' }
  | { mode: 'every'; n: number }
  | { mode: 'range'; from: number; to: number }
  | { mode: 'pick'; generations: number[] };

export const MAX_GHOSTS = 32;

/**
 * Generations (0-based) to show as ghosts. Auto mode is log spaced: dense at
 * the start where behavior changes fastest, then every 10th. When there are
 * too many, older ones are thinned evenly and the newest are kept.
 */
export function selectGhosts(sel: GhostSelection, available: number): number[] {
  if (available <= 0) return [];
  const last = available - 1;
  let gens: number[];
  switch (sel.mode) {
    case 'auto': {
      const early = [0, 1, 2, 4, 7, 12];
      gens = early.filter((g) => g <= last);
      for (let g = 19; g <= last; g += 10) gens.push(g);
      break;
    }
    case 'every':
      gens = [];
      for (let g = 0; g <= last; g += Math.max(1, sel.n)) gens.push(g);
      break;
    case 'range':
      gens = [];
      for (let g = Math.max(0, sel.from); g <= Math.min(last, sel.to); g++) gens.push(g);
      break;
    case 'pick':
      gens = sel.generations.filter((g) => g >= 0 && g <= last);
      break;
  }
  if (!gens.includes(last)) gens.push(last);
  gens = [...new Set(gens)].sort((a, b) => a - b);
  if (gens.length > MAX_GHOSTS) {
    const keepNewest = 8;
    const older = gens.slice(0, gens.length - keepNewest);
    const room = MAX_GHOSTS - keepNewest;
    const thinned = Array.from({ length: room }, (_, i) => older[Math.round((i * (older.length - 1)) / (room - 1))]);
    gens = [...new Set([...thinned, ...gens.slice(-keepNewest)])];
  }
  return gens;
}

/**
 * What the replay worker needs to re-simulate each chosen champion: its
 * genome, the seed its car drove with and the script it trained under.
 * Generations without a stored record are skipped.
 */
export function ghostSpecs(run: RunConfig, records: GenerationRecord[], gens: number[]): GhostSpec[] {
  const byGen = new Map(records.map((r) => [r.generation, r]));
  return gens
    .map((g) => byGen.get(g))
    .filter((r) => r !== undefined)
    .map((r) => ({ generation: r.generation, genome: r.genome, seed: r.replaySeed, scriptSource: scriptAt(run, r.generation)?.source ?? null }));
}
