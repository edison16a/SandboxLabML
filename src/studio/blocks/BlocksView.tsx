'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { CircleAlert, Lock } from 'lucide-react';
import { fromBlocks, lineOf, print, toBlocks, type BlockWorkspace } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { Switch } from '@/ui/primitives/Switch';
import { analyze } from '../doc/analyze';
import { lastValidText } from '../doc/lastValid';
import { duplicate } from '../state/scriptActions';
import { selectText, useStudio } from '../state/studioStore';
import { BlocksContext, type BlocksApi, type BlockEdit } from './BlocksContext';
import { HeaderCard } from './HeaderCard';
import { Palette } from './Palette';
import type { PaletteScope } from './model/palette';
import { placeBlock, scopeOfPath } from './model/place';
import { pathKey, type BlockPath } from './model/paths';
import { AddSections, EachSection, TopSection } from './Sections';

function Banner({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const style = tone === 'warn' ? 'border-warn/40 bg-warn/10' : 'border-border-strong bg-surface-2';
  return (
    <div role="status" className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${style}`}>
      {children}
    </div>
  );
}

/**
 * The blocks view. It never keeps a tree of its own: every render parses
 * the current text, and every edit prints a new text, so the code view and
 * the undo stack always agree with what is shown. While the text has a
 * syntax error, the last tree that parsed stays on screen, dimmed and read
 * only, and the text itself is left exactly as typed.
 */
export default function BlocksView() {
  const text = useStudio(selectText);
  const presetOnly = useStudio((s) => s.script?.readonly ?? true);
  const scriptId = useStudio((s) => s.script?.id ?? null);
  const explain = useStudio((s) => s.explain);
  const history = useStudio((s) => s.history);
  const analysis = useMemo(() => analyze(text), [text]);
  // While the text is broken, show the newest earlier version that parsed. The undo history already holds it.
  const shown = useMemo(() => (analysis.syntaxError ? lastValidText(history) : text), [analysis, history, text]);
  const ws = useMemo(() => (shown === null ? null : toBlocks(analyze(shown).parsed.program)), [shown]);
  const wsRef = useRef(ws);
  wsRef.current = ws;

  const [selection, setSelection] = useState<BlockPath | null>(null);
  const selected = selection ? pathKey(selection) : null;
  const [scope, setScope] = useState<PaletteScope>('tick');
  const broken = analysis.syntaxError !== null;
  const readOnly = presetOnly || broken;
  const env = analysis.env ?? 'racing';

  const select = useCallback((path: BlockPath | null) => {
    setSelection(path);
    if (path && wsRef.current) setScope(scopeOfPath(wsRef.current, path));
  }, []);

  const apply = useCallback(
    (edit: (ws: BlockWorkspace) => BlockEdit) => {
      const current = wsRef.current;
      if (!current) return;
      const result = edit(current);
      const next = 'select' in result ? result.ws : result;
      if ('select' in result) select(result.select);
      if (next !== current) useStudio.getState().edit(print(fromBlocks(next)));
    },
    [select],
  );

  const locals = useMemo(() => analysis.checked.declarations.map((d) => d.name), [analysis]);
  const api = useMemo<BlocksApi | null>(() => (ws ? { ws, env, readOnly, explain, locals, selected, select, apply } : null), [ws, env, readOnly, explain, locals, selected, select, apply]);
  const add = (block: Parameters<typeof placeBlock>[1]) => apply((w) => placeBlock(w, block, scope, selection));

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row" data-testid="blocks-view">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          <div className="flex items-center justify-end gap-2 text-[12px] text-muted">
            <span>Explain</span>
            <Switch checked={explain} onChange={(v) => useStudio.setState({ explain: v })} label="Explain each block in plain words" />
          </div>
          {broken && analysis.syntaxError && (
            <Banner tone="warn">
              <CircleAlert className="size-4 text-warn" />
              <span>Fix line {lineOf(text, analysis.syntaxError.span.from)} to edit blocks.</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => useStudio.getState().revealSpan(analysis.syntaxError!.span.from, analysis.syntaxError!.span.to)}>
                Show in code
              </Button>
            </Banner>
          )}
          {presetOnly && scriptId && (
            <Banner tone="info">
              <Lock className="size-4 text-muted" />
              <span>This preset is read only.</span>
              <Button size="sm" variant="primary" className="ml-auto" onClick={() => void duplicate(scriptId)}>
                Duplicate to edit
              </Button>
            </Banner>
          )}
          {api ? (
            <BlocksContext.Provider value={api}>
              <div className={broken ? 'pointer-events-none flex flex-col gap-4 opacity-50 select-none' : 'flex flex-col gap-4'} aria-disabled={broken}>
                <HeaderCard />
                <TopSection />
                {api.ws.items.map((b, i) => (b.type === 'each' ? <EachSection key={b.id} block={b} index={i} /> : null))}
                <AddSections />
              </div>
            </BlocksContext.Provider>
          ) : (
            <p className="py-16 text-center text-[13px] text-muted">The blocks appear once the script reads cleanly.</p>
          )}
        </div>
      </div>
      <Palette env={env} scope={scope} onScope={setScope} onAdd={add} disabled={readOnly || !api} className="h-72 shrink-0 border-t border-border md:h-auto md:w-72 md:border-t-0 md:border-l" />
    </div>
  );
}

