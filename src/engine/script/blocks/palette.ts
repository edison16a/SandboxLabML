import type { EnvId } from '../../env/types';
import { parse } from '../parser';
import { entriesFor, type BlockCategory, type RegistryEntry } from '../registry';
import { HOLE } from './fromBlocks';
import { toBlocks } from './toBlocks';
import type { ScriptBlock } from './types';

export interface PaletteItem {
  /** Registry name, or a language word such as "reward" or "if". */
  key: string;
  /** Label template with `{param}` holes, as shown on the block. */
  label: string;
  summary: string;
  /** A ready block to drop into the workspace. Empty slots are null inputs. */
  template: ScriptBlock;
}

export interface PaletteCategory {
  id: BlockCategory;
  label: string;
  items: PaletteItem[];
}

const ORDER: readonly BlockCategory[] = ['sensors', 'actions', 'rewards', 'logic', 'math', 'evolution', 'environment'];
const LABELS: Record<BlockCategory, string> = {
  sensors: 'Sensors',
  actions: 'Actions',
  rewards: 'Rewards and stops',
  logic: 'Logic',
  math: 'Math',
  evolution: 'Evolution',
  environment: 'Environment',
};

type Scope = 'tick' | 'generation';

interface LanguageBlock {
  key: string;
  category: BlockCategory;
  label: string;
  summary: string;
  source: string;
  scopes: readonly Scope[];
  value?: boolean;
}

const BOTH: readonly Scope[] = ['tick', 'generation'];
const _ = HOLE;

/** Blocks for the language itself. Their templates are written in SBL and converted, so they always match the parser. */
const LANGUAGE: readonly LanguageBlock[] = [
  { key: 'reward', category: 'rewards', label: 'reward {value} when {when}', summary: 'Add points, every tick or only when a condition holds.', source: 'reward 1', scopes: ['tick'] },
  { key: 'stop', category: 'rewards', label: 'stop {reason} when {when}', summary: "End an agent's run when a condition holds.", source: `stop "crash" when ${_}`, scopes: ['tick'] },
  { key: 'if', category: 'logic', label: 'if {cond}', summary: 'Run blocks only when a condition is true.', source: `if ${_} {\n}`, scopes: BOTH },
  { key: 'if else', category: 'logic', label: 'if {cond} else', summary: 'Pick between two sets of blocks.', source: `if ${_} {\n} else {\n}`, scopes: BOTH },
  { key: 'repeat', category: 'logic', label: 'repeat {count} times', summary: 'Run blocks a fixed number of times, up to 64.', source: 'repeat 3 {\n}', scopes: BOTH },
  { key: 'let', category: 'logic', label: 'let {name} = {value}', summary: 'Give a value a name for this tick.', source: `let value = ${_}`, scopes: BOTH },
  { key: 'compare', category: 'logic', label: '{left} > {right}', summary: 'Compare two numbers with the same unit.', source: `${_} > ${_}`, scopes: BOTH, value: true },
  { key: 'and', category: 'logic', label: '{left} and {right}', summary: 'True when both sides are true.', source: `${_} and ${_}`, scopes: BOTH, value: true },
  { key: 'or', category: 'logic', label: '{left} or {right}', summary: 'True when either side is true.', source: `${_} or ${_}`, scopes: BOTH, value: true },
  { key: 'not', category: 'logic', label: 'not {operand}', summary: 'Flips true and false.', source: `not ${_}`, scopes: BOTH, value: true },
  { key: 'true', category: 'logic', label: 'true', summary: 'Always true.', source: 'true', scopes: BOTH, value: true },
  { key: 'number', category: 'math', label: '{value} {unit}', summary: 'A number, with a unit when it measures something.', source: '0', scopes: BOTH, value: true },
  { key: 'arithmetic', category: 'math', label: '{left} + {right}', summary: 'Add, subtract, multiply or divide.', source: `${_} + ${_}`, scopes: BOTH, value: true },
];

/** Replaces `_` placeholders with empty slots. */
function clearHoles(b: ScriptBlock): ScriptBlock {
  return {
    ...b,
    inputs: b.inputs.map((i) => ({ name: i.name, block: i.block && !(i.block.type === 'name' && i.block.fields.name === HOLE) ? clearHoles(i.block) : null })),
    children: Object.fromEntries(Object.entries(b.children).map(([k, list]) => [k, list.map(clearHoles)])),
  };
}

function template(env: EnvId, scope: Scope, source: string, value: boolean): ScriptBlock | null {
  const text = value ? `reward ${source}` : source;
  const ws = toBlocks(parse(`script "palette" for ${env} v1\neach ${scope} {\n${text}\n}\n`).program);
  const stmt = ws.items[0]?.children.body?.[0];
  if (!stmt) return null;
  const block = value ? stmt.inputs[0]?.block : stmt;
  return block ? clearHoles(block) : null;
}

function entrySource(e: RegistryEntry): { source: string; value: boolean } {
  const holes = e.params.filter((p) => p.required).map((p) => `${p.name}: ${_}`);
  switch (e.kind) {
    case 'sensor':
    case 'constant':
      return { source: e.name, value: true };
    case 'function':
      return { source: `${e.name}(${e.params.map((p) => (e.params.length === 1 ? _ : `${p.name}: ${_}`)).join(', ')})`, value: true };
    case 'collection':
      return { source: `for each item in ${e.name} {\n}`, value: false };
    default:
      return { source: e.example.startsWith(`${e.name}(`) ? e.example.split('\n')[0] : `${e.name}(${holes.join(', ')})`, value: false };
  }
}

/** Palette for one environment and block, grouped by category, built from the registry. */
export function blockPalette(env: EnvId, scope: Scope): PaletteCategory[] {
  const groups = new Map<BlockCategory, PaletteItem[]>(ORDER.map((c) => [c, []]));
  for (const l of LANGUAGE) {
    if (!l.scopes.includes(scope)) continue;
    const t = template(env, scope, l.source, l.value === true);
    if (t) groups.get(l.category)?.push({ key: l.key, label: l.label, summary: l.summary, template: t });
  }
  for (const e of entriesFor(env, scope)) {
    const { source, value } = entrySource(e);
    const t = template(env, scope, source, value);
    if (t) groups.get(e.block.category)?.push({ key: e.name, label: e.block.label, summary: e.summary, template: t });
  }
  return ORDER.map((id) => ({ id, label: LABELS[id], items: groups.get(id) ?? [] })).filter((c) => c.items.length > 0);
}
