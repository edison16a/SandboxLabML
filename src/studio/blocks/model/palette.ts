import type { EnvId } from '@/engine/env/types';
import { blockPalette, parse, scriptEnv, toBlocks, type PaletteCategory, type PaletteItem } from '@/engine/script';

export type PaletteScope = 'top' | 'tick' | 'generation';

/** The sensor block's example, in each env's own names, so it checks clean the moment it lands. */
const SENSOR_EXAMPLES: Partial<Record<EnvId, string>> = {
  driving: 'sensor gap "Gap" in 0 m .. 50 m = carAhead.gap',
  navigation: 'sensor spikes "Spikes" in 0 m .. 20 m = agent.spikeDistance',
};

/** An env without an example of its own takes its snippet template, with each blank filled by its default. */
function sensorExample(env: EnvId): string {
  return SENSOR_EXAMPLES[env] ?? (scriptEnv(env)?.templates?.sensor ?? 'sensor x "X" in 0 .. 1 = 0').replace(/\$\{\d+:([^}]*)\}/g, '$1');
}

const TOP_ITEMS: ReadonlyArray<{ key: string; label: string; summary: string; source: (env: EnvId) => string }> = [
  { key: 'sensor', label: 'sensor {name}', summary: 'A brain input of your own, read every tick.', source: sensorExample },
  { key: 'let', label: 'let {name} = {value}', summary: 'A named constant both sections can use.', source: () => 'let target = 1' },
  { key: 'each tick', label: 'each tick', summary: 'Runs for every agent, every tick of its episode.', source: () => 'each tick {\n}' },
  { key: 'each generation', label: 'each generation', summary: 'Runs once after every generation.', source: () => 'each generation {\n}' },
];

const topCache = new Map<EnvId, PaletteCategory[]>();

/** Blocks for the top level of a script, made from SBL so they always match the parser. */
function topPalette(env: EnvId): PaletteCategory[] {
  let cached = topCache.get(env);
  if (!cached) {
    const items: PaletteItem[] = [];
    for (const t of TOP_ITEMS) {
      const block = toBlocks(parse(`script "p" for ${env} v1\n${t.source(env)}\n`).program).items[0];
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
