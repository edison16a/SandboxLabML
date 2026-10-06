'use client';

import { useMemo, useState } from 'react';
import { entriesByName, type EntryKind, type RegistryEntry } from '@/engine/script';
import { TextInput } from '@/ui/primitives/Field';
import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { ReferenceEntry } from './ReferenceEntry';

const KIND_ORDER: ReadonlyArray<[EntryKind, string]> = [
  ['sensor', 'Sensors'],
  ['collection', 'Lists'],
  ['action', 'Actions'],
  ['operator', 'Evolution operators'],
  ['function', 'Functions'],
  ['constant', 'Constants'],
];

/** Categories in palette order, so racing sensors come before the generation counters. */
const CATEGORY_ORDER = ['sensors', 'actions', 'rewards', 'logic', 'math', 'evolution', 'environment'];

/** Registry entries grouped by kind, then by block category, filtered by a search over names and summaries. */
export function groupEntries(entries: readonly RegistryEntry[], query: string): Array<{ kind: string; categories: Array<{ category: string; entries: RegistryEntry[] }> }> {
  const q = query.trim().toLowerCase();
  const hit = (e: RegistryEntry) => !q || e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q) || e.block.label.toLowerCase().includes(q);
  return KIND_ORDER.map(([kind, label]) => {
    const byCategory = new Map<string, RegistryEntry[]>();
    for (const e of entries) {
      if (e.kind !== kind || !hit(e)) continue;
      const list = byCategory.get(e.block.category) ?? [];
      list.push(e);
      byCategory.set(e.block.category, list);
    }
    const categories = [...byCategory].sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]));
    return { kind: label, categories: categories.map(([category, list]) => ({ category, entries: list })) };
  }).filter((g) => g.categories.length > 0);
}

/**
 * Searchable docs for everything the open script's environment offers,
 * plus the core math every script can use.
 */
export function ReferenceTab() {
  const text = useStudio(selectText);
  const readonly = useStudio((s) => s.script?.readonly ?? true);
  const env = analyze(text).env ?? 'racing';
  const [query, setQuery] = useState('');
  const groups = useMemo(() => groupEntries([...entriesByName(env).values()], query), [env, query]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-3">
        <TextInput aria-label="Search the reference" placeholder={`Search ${env === 'racing' ? 'Racing' : 'Hide and Seek'} and core names`} value={query} onChange={(e) => setQuery(e.target.value)} className="w-full" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.length === 0 && <p className="py-8 text-center text-[13px] text-muted">Nothing matches &quot;{query}&quot;.</p>}
        {groups.map((g) => (
          <section key={g.kind} className="mb-5">
            <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">{g.kind}</h3>
            {g.categories.map((c) => (
              <div key={c.category} className="mb-3">
                {g.categories.length > 1 && <h4 className="mb-1.5 text-[11px] text-subtle capitalize">{c.category}</h4>}
                <div className="flex flex-col gap-1.5">
                  {c.entries.map((e) => (
                    <ReferenceEntry key={e.name} entry={e} readonly={readonly} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
