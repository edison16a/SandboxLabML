import { autocompletion, snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { PRESET_BLUEPRINTS } from '@/engine/blueprints/presets';
import { callSnippets, entriesFor, SNIPPETS, type RegistryEntry } from '@/engine/script';
import { analyze } from '../doc/analyze';
import { scopeAt, unitContext, type CursorScope } from './context';
import { completionInfo } from './docCard';

const UNITS: ReadonlyArray<[string, string]> = [
  ['m', 'meters'],
  ['s', 'seconds'],
  ['m/s', 'meters per second'],
  ['m/s2', 'meters per second squared'],
  ['deg', 'degrees'],
  ['rad', 'radians'],
  ['1/m', 'per meter, for road bends'],
  ['%', 'percent, 20% is 0.2'],
];

const unitOptions: Completion[] = UNITS.map(([label, detail]) => ({ label, detail, type: 'unit' }));

function entryOption(e: RegistryEntry, boost = 0): Completion {
  const type = e.kind === 'sensor' ? 'variable' : e.kind === 'constant' ? 'constant' : e.kind === 'collection' ? 'property' : 'function';
  return { label: e.name, detail: e.summary, type, boost, info: () => completionInfo(e) };
}

/** Registry names, call templates, language snippets and local names for one block. */
function optionsFor(scope: CursorScope, source: string): Completion[] {
  const a = analyze(source);
  const env = a.env ?? 'racing';
  const snippets = SNIPPETS.filter((s) => s.scopes.includes(scope)).map((s) => snippetCompletion(s.template, { label: s.label, detail: s.detail, type: 'keyword', boost: 2 }));
  if (scope === 'top') return snippets;
  const entries = entriesFor(env, scope);
  const callable = new Map(callSnippets(env, scope).map((s) => [s.label, s]));
  const fromRegistry = entries.map((e) => {
    const call = callable.get(e.name);
    if (!call) return entryOption(e, e.presets.length > 0 ? 1 : 0);
    return snippetCompletion(call.template, { label: e.name, detail: e.summary, type: 'function', boost: 1, info: () => completionInfo(e) });
  });
  const locals = a.checked.declarations
    .filter((d) => d.kind !== 'sensor')
    .map((d): Completion => ({ label: d.name, detail: d.kind === 'loop' ? 'loop item' : 'your value', type: 'variable', boost: 3 }));
  const sensors = a.parsed.program.items.flatMap((i) => (i.kind === 'sensor' ? [{ label: i.name, detail: `your sensor "${i.label}"`, type: 'variable', boost: 3 }] : []));
  return [...snippets, ...fromRegistry, ...locals, ...sensors];
}

function brainOptions(source: string): Completion[] {
  const env = analyze(source).env ?? 'racing';
  return PRESET_BLUEPRINTS.filter((b) => b.env === env).map((b) => ({ label: b.id, detail: b.description, type: 'constant' }));
}

/**
 * Suggestions that follow the cursor: units right after a number, brain
 * blueprints after `brain`, and otherwise names and templates valid in the
 * block the cursor is in, so `each generation` never offers `drive`.
 */
export function sblCompletions(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const before = line.text.slice(0, ctx.pos - line.from);
  const source = ctx.state.doc.toString();

  const unit = unitContext(before);
  const partial = unit ? before.slice(unit.unitFrom).toLowerCase() : '';
  if (unit && UNITS.some(([u]) => u.startsWith(partial))) {
    return { from: line.from + unit.unitFrom, options: unitOptions, validFor: /^[a-z/%2]*$/i };
  }
  const brain = /^\s*brain\s+([\w-]*)$/.exec(before);
  if (brain) return { from: ctx.pos - brain[1].length, options: brainOptions(source), validFor: /^[\w-]*$/ };

  const word = ctx.matchBefore(/[A-Za-z_][\w.]*/);
  if (!word && !ctx.explicit) return null;
  if (/"[^"]*$/.test(before) || before.includes('//')) return null;
  const scope = scopeAt(source, ctx.pos);
  return { from: word ? word.from : ctx.pos, options: optionsFor(scope, source), validFor: /^[\w.]*$/ };
}

export const sblCompletion = autocompletion({ override: [sblCompletions], icons: false, maxRenderedOptions: 60 });
