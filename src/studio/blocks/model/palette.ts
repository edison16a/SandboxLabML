import type { EnvId } from '@/engine/env/types';
import { blockPalette, parse, toBlocks, type PaletteCategory, type PaletteItem } from '@/engine/script';

export type PaletteScope = 'top' | 'tick' | 'generation';

const TOP_ITEMS: ReadonlyArray<{ key: string; label: string; summary: string; source: string }> = [
  { key: 'sensor', label: 'sensor {name}', summary: 'A brain input of your own, read every tick.', source: 'sensor gap "Gap" in 0 m .. 60 m = rays.min' },
  { key: 'let', label: 'let {name} = {value}', summary: 'A named constant both sections can use.', source: 'let target = 1' },
  { key: 'each tick', label: 'each tick', summary: 'Runs for every agent, 30 times a second.', source: 'each tick {\n}' },
  { key: 'each generation', label: 'each generation', summary: 'Runs once after every generation.', source: 'each generation {\n}' },
];

const topCache = new Map<EnvId, PaletteCategory[]>();

/** Blocks for the top level of a script, made from SBL so they always match the parser. */
function topPalette(env: EnvId): PaletteCategory[] {
  let cached = topCache.get(env);
  if (!cached) {
    const items: PaletteItem[] = [];
    for (const t of TOP_ITEMS) {
      const block = toBlocks(parse(`script "p" for ${env} v1\n${t.source}\n`).program).items[0];
      if (block) items.push({ key: t.key, label: t.label, summary: t.summary, template: block });
    }
    cached = [{ id: 'logic', label: 'Script parts', items }];
    topCache.set(env, cached);
  }
  return structuredClone(cached);
}

/** Palette for the section being edited. */
export function paletteFor(env: EnvId, scope: PaletteScope): PaletteCategory[] {
  return scope === 'top' ? topPalette(env) : blockPalette(env, scope);
}
