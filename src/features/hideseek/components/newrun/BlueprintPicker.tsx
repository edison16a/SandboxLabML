'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { blueprintInputCount } from '@/engine/blueprints/shape';
import type { HideSeekBlueprint } from '@/engine/blueprints/types';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { listBlueprints } from '@/storage/blueprints';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';

const choice = (selected: boolean) =>
  cn('flex flex-col gap-0.5 rounded-md border p-2.5 text-left transition-colors', selected ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong');

/** "Hide and Seek Standard" reads as "Standard" on its tile. The user's own names stay as typed. */
const short = (b: HideSeekBlueprint) => b.name.replace('Hide and Seek ', '');

/**
 * The brain blueprint for a new run: the presets, the user's own Hide and
 * Seek blueprints, and a tile that opens the editor on a copy of the one
 * picked. A blueprint saved there is picked straight away.
 */
export function BlueprintPicker({ open, value, onChange }: { open: boolean; value: HideSeekBlueprint; onChange: (b: HideSeekBlueprint) => void }) {
  const [custom, setCustom] = useState<HideSeekBlueprint[]>([]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (open) void listBlueprints('hideseek').then((list) => setCustom(list.filter((b): b is HideSeekBlueprint => b.env === 'hideseek')));
  }, [open]);
  // A copy keeps the preset's teaching line, which no longer holds once its inputs change.
  const hint = value.readonly ? value.teaches : 'Your own blueprint.';
  return (
    <Field label="Brain blueprint" hint={hint}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...HIDESEEK_BLUEPRINTS, ...custom].map((b) => (
          <button key={b.id} type="button" onClick={() => onChange(b)} className={choice(b.id === value.id)}>
            <span className="truncate text-[13px] font-medium">{short(b)}</span>
            <span className="text-[11px] text-muted">{blueprintInputCount(b)} inputs</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-2.5 text-[13px] text-muted hover:border-border-strong hover:text-fg"
        >
          <SlidersHorizontal className="size-4 shrink-0" />
          <span className="truncate">Customize {short(value)}</span>
        </button>
      </div>
      <BlueprintDialog
        open={editing}
        onOpenChange={setEditing}
        base={value}
        title="Customize the brain"
        description="Both teams get it. Saved as your own blueprint."
        action="Use this blueprint"
        onSave={(b) => {
          setCustom((list) => [b, ...list]);
          onChange(b);
        }}
      />
    </Field>
  );
}
