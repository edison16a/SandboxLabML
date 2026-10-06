'use client';

import { PRESET_BLUEPRINTS } from '@/engine/blueprints/presets';
import { parse, toBlocks } from '@/engine/script';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { useBlocks } from './BlocksContext';
import { InlineField } from './editors/InlineField';

const NO_BRAIN = '__none__';

/**
 * The `script` and `brain` lines as a card above the sections: the
 * script's name, its environment and the brain blueprint it trains.
 */
export function HeaderCard() {
  const { ws, env, readOnly, apply } = useBlocks();
  const header = ws.header;
  if (!header) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[13px] text-muted">
        This script has no script line yet.
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => apply((w) => ({ ...w, header: toBlocks(parse('script "My script" for racing v1\n').program).header }))}>
            Add it
          </Button>
        )}
      </div>
    );
  }
  const brainId = ws.brain ? String(ws.brain.fields.id) : NO_BRAIN;
  const brains = PRESET_BLUEPRINTS.filter((b) => b.env === (env ?? header.fields.env));
  const setBrain = (id: string) =>
    apply((w) => {
      if (id === NO_BRAIN) return { ...w, brain: null };
      const brain = w.brain ?? toBlocks(parse(`script "x" for racing v1\nbrain ${id}\n`).program).brain;
      return brain ? { ...w, brain: { ...brain, fields: { ...brain.fields, id } } } : w;
    });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="text-[13px] font-semibold">script</span>
      <InlineField label="Script title" quoted value={String(header.fields.name)} readOnly={readOnly} onCommit={(v) => apply((w) => (w.header ? { ...w, header: { ...w.header, fields: { ...w.header.fields, name: v } } } : w))} />
      <Badge tone="accent">for {String(header.fields.env)}</Badge>
      <Badge>v{String(header.fields.version)}</Badge>
      <label className="ml-auto flex items-center gap-2 text-[12px] text-muted">
        brain
        <select
          aria-label="Brain blueprint"
          disabled={readOnly}
          value={brainId}
          onChange={(e) => setBrain(e.target.value)}
          className="h-7 rounded-md border border-border bg-surface-2 px-2 font-mono text-[12px] text-fg hover:border-border-strong"
        >
          <option value={NO_BRAIN}>run default</option>
          {[...new Set([...(brainId === NO_BRAIN ? [] : [brainId]), ...brains.map((b) => b.id)])].map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
