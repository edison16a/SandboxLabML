import type { EnvId } from '../../env/types';
import { formatNumber, quote } from '../printExpr';
import { entriesFor, type ParamDef } from '../registry';

/** Where a snippet makes sense: the top level of a script, or inside one of the blocks. */
export type SnippetScope = 'top' | 'tick' | 'generation';

/**
 * A template for typing help. Placeholders use the editor's `${n:text}`
 * syntax, so the cursor can jump from one blank to the next.
 */
export interface Snippet {
  label: string;
  detail: string;
  template: string;
  scopes: readonly SnippetScope[];
}

const BLOCKS: readonly SnippetScope[] = ['tick', 'generation'];

export const SNIPPETS: readonly Snippet[] = [
  { label: 'reward when', detail: 'Give points when something happens', template: 'reward ${1:+1} when ${2:checkpoint.passed}', scopes: ['tick'] },
  { label: 'reward every tick', detail: 'Give points every tick, scaled by a sensor', template: 'reward ${1:+0.01} * ${2:car.speed}', scopes: ['tick'] },
  { label: 'stop when', detail: 'End an agent run when something happens', template: 'stop "${1:crash}" when ${2:car.offTrack}', scopes: ['tick'] },
  { label: 'if', detail: 'Run lines only when a condition is true', template: 'if ${1:condition} {\n  ${2}\n}', scopes: BLOCKS },
  { label: 'if else', detail: 'Pick between two sets of lines', template: 'if ${1:condition} {\n  ${2}\n} else {\n  ${3}\n}', scopes: BLOCKS },
  { label: 'let', detail: 'Give a value a name', template: 'let ${1:name} = ${2:value}', scopes: ['top', 'tick', 'generation'] },
  { label: 'repeat', detail: 'Run lines a fixed number of times', template: 'repeat ${1:3} {\n  ${2}\n}', scopes: BLOCKS },
  { label: 'for each', detail: 'Run lines once for each item of a list', template: 'for each ${1:r} in ${2:rays} {\n  ${3}\n}', scopes: ['tick'] },
  { label: 'sensor', detail: 'Add a brain input of your own', template: 'sensor ${1:name} "${2:Label}" in ${3:0 m} .. ${4:60 m} = ${5:rays.min}', scopes: ['top'] },
  { label: 'each tick', detail: 'Lines that run for every agent, every tick', template: 'each tick {\n  ${1:drive(steer: brain.steer, pedal: brain.pedal)}\n}', scopes: ['top'] },
  {
    label: 'each generation',
    detail: 'Lines that run once per generation',
    template: 'each generation {\n  speciate(target: ${1:8})\n  select(top: ${2:20%})\n  breed(crossover: ${3:0.75}, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03 })\n  keepChampions()\n}',
    scopes: ['top'],
  },
  { label: 'script', detail: 'The first line of every script', template: 'script "${1:My script}" for ${2:racing} v1', scopes: ['top'] },
  { label: 'brain', detail: 'Pick the brain blueprint', template: 'brain ${1:racing-starter}', scopes: ['top'] },
];

/**
 * Blanks in the shared templates hold racing names. A Hide and Seek script
 * gets the same templates with its own names, so a snippet never inserts
 * a name the checker would reject.
 */
const HIDESEEK_TEMPLATES: Readonly<Record<string, string>> = {
  'reward when': 'reward ${1:+1} * dt when ${2:agent.hidden}',
  'reward every tick': 'reward ${1:+0.1} * dt * ${2:agent.boxesLocked}',
  'stop when': 'stop "${1:done}" when ${2:agent.timeLeft < 1 s}',
  'each tick': 'each tick {\n  ${1:act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)}\n}',
  script: 'script "${1:My script}" for ${2:hideseek} v1',
  brain: 'brain ${1:hideseek-starter}',
};

const HIDESEEK_SNIPPETS: readonly Snippet[] = SNIPPETS.map((s) => ({ ...s, template: HIDESEEK_TEMPLATES[s.label] ?? s.template }));

function placeholder(p: ParamDef, n: number): string {
  let text: string;
  if (p.type === 'string') text = quote(String(p.choices?.[0] ?? p.default ?? ''));
  else if (p.type === 'bool') text = String(p.default ?? true);
  else if (p.type === 'record') text = `{ ${(p.fields ?? []).map((f) => `${f.name}: 0`).join(', ')} }`;
  else text = formatNumber(Number(p.default ?? 0)) + (p.unit && p.unit !== '*' ? ` ${p.unit}` : '');
  return `\${${n}:${text}}`;
}

/** A snippet per registry action, operator and function, with the required arguments as blanks. */
export function callSnippets(env: EnvId | null, scope: 'tick' | 'generation'): Snippet[] {
  return entriesFor(env, scope)
    .filter((e) => e.kind === 'action' || e.kind === 'operator' || e.kind === 'function')
    .map((e) => {
      const args = e.params.filter((p) => p.required).map((p, i) => (e.name === 'abs' || e.name === 'sqrt' || e.name === 'sign' ? placeholder(p, i + 1) : `${p.name}: ${placeholder(p, i + 1)}`));
      return { label: e.name, detail: e.summary, template: `${e.name}(${args.join(', ')})`, scopes: [scope] };
    });
}

/** Snippets whose label starts with what was typed, so typing `rew` offers the reward templates. */
export function snippetsFor(prefix: string, scope: SnippetScope, env: EnvId | null = 'racing'): Snippet[] {
  const p = prefix.trim().toLowerCase();
  const shared = env === 'hideseek' ? HIDESEEK_SNIPPETS : SNIPPETS;
  const all = [...shared, ...(scope === 'top' ? [] : callSnippets(env, scope))];
  return all.filter((s) => s.scopes.includes(scope) && s.label.toLowerCase().startsWith(p));
}
