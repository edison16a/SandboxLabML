'use client';

import { useEffect, useState } from 'react';
import { blueprintInputCount, blueprintShape, validateBlueprint } from '@/engine/blueprints/shape';
import type { Blueprint } from '@/engine/blueprints/types';
import { startingLinks } from '@/engine/neat/startShape';
import { copyId, saveBlueprint } from '@/storage/blueprints';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { BrainStartFields } from './BrainStartFields';
import { BLUEPRINT_FORMS } from './forms';

interface Props<B extends Blueprint> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Blueprint to start from. Presets are copied, never edited in place. */
  base: B;
  title: string;
  description: string;
  action: string;
  onSave: (b: B) => void | Promise<void>;
}

/** Starting parameter count for a shape, so the dialog can show how big the brain begins. */
function startingParameters(b: Blueprint): number {
  return startingLinks(blueprintShape(b));
}

/**
 * The form for a blueprint's env, from BLUEPRINT_FORMS. The draft keeps the
 * base's env, so the cast only undoes the narrowing. An env without a form
 * of its own gets the fields every blueprint shares: noise and how the
 * brain starts.
 */
function BlueprintForm<B extends Blueprint>({ value, onChange }: { value: B; onChange: (b: B) => void }) {
  const Form = BLUEPRINT_FORMS[value.env];
  if (Form) return <Form value={value} onChange={onChange as (b: Blueprint) => void} />;
  return <BrainStartFields value={value} onChange={onChange} />;
}

/** Edits a copy of a blueprint of any env, shows its size live, and saves it as the user's own. */
export function BlueprintDialog<B extends Blueprint>({ open, onOpenChange, base, title, description, action, onSave }: Props<B>) {
  const [draft, setDraft] = useState<B>(base);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setDraft({ ...structuredClone(base), id: copyId(base.id), name: base.readonly ? `${base.name} (custom)` : base.name, readonly: false, tier: 'custom' });
  }, [open, base]);
  const issues = validateBlueprint(draft);
  const save = async () => {
    setBusy(true);
    try {
      await saveBlueprint(draft);
      await onSave(draft);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-2xl"
      footer={
        <>
          {/* On a phone only the input count fits beside the buttons. */}
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <Badge tone="accent">{blueprintInputCount(draft)} inputs</Badge>
            <Badge className="hidden sm:inline-flex">{startingParameters(draft)} starting parameters</Badge>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={issues.length > 0 || busy} onClick={() => void save()}>
            {action}
          </Button>
        </>
      }
    >
      <BlueprintForm value={draft} onChange={setDraft} />
      {issues.length > 0 && (
        <ul className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          {issues.map((i) => (
            <li key={i.field + i.message}>{i.message}</li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
