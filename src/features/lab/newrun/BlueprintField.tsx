'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { blueprintInputCount } from '@/engine/blueprints/shape';
import type { Blueprint } from '@/engine/blueprints/types';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { listBlueprints } from '@/storage/blueprints';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';
import { useLabContext } from '../LabContext';

interface Props<B extends Blueprint> {
  /** Reloads the user's own blueprints when it turns true, such as when the dialog opens. */
  open: boolean;
  value: B;
  onChange: (b: B) => void;
  /** Told when the customize dialog opens and closes, so the dialog this field sits in can step aside. */
  onEditingChange?: (editing: boolean) => void;
}

/**
 * The brain picker of a new run: the env's preset blueprints and the
 * user's own, plus a tile that customizes the selected one into a copy.
 */
export function BlueprintField<B extends Blueprint>({ open, value, onChange, onEditingChange }: Props<B>) {
  const { env, module } = useLabContext();
  const [custom, setCustom] = useState<B[]>([]);
  const [editing, setEditingState] = useState(false);
  const setEditing = (on: boolean) => {
    setEditingState(on);
    onEditingChange?.(on);
  };
  useEffect(() => {
    if (open) void listBlueprints(env).then((list) => setCustom(list.filter((b): b is B => b.env === env)));
  }, [open, env]);
  const blueprints = [...(module.blueprints as readonly B[]), ...custom];
  // Preset names start with the lab's name, which the picker already says.
  const short = (b: Blueprint) => b.name.replace(`${module.label} `, '');

  return (
    <>
      <Field label="Brain blueprint" hint={value.teaches || 'Your own blueprint.'}>
        <div className="grid grid-cols-2 gap-2">
          {blueprints.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b)}
              className={cn('flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left', b.id === value.id ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
            >
              <span className="text-[13px] font-medium">{short(b)}</span>
              <span className="text-[11px] text-muted">{blueprintInputCount(b)} inputs. {b.description ? `${b.description.split('.')[0]}.` : 'Custom blueprint.'}</span>
            </button>
          ))}
          <button type="button" onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-2.5 text-[13px] text-muted hover:border-border-strong hover:text-fg">
            <SlidersHorizontal className="size-4" />
            Customize {short(value)}
          </button>
        </div>
      </Field>
      <BlueprintDialog
        open={editing}
        onOpenChange={setEditing}
        base={value}
        title="Customize the brain"
        description="Saved as your own blueprint."
        action="Use this blueprint"
        onSave={(b) => {
          setCustom((list) => [b, ...list]);
          onChange(b);
        }}
      />
    </>
  );
}
