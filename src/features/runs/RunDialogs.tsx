'use client';

import { useEffect, useState } from 'react';
import { listCheckpoints } from '@/storage/checkpoints';
import type { CheckpointRow, RunRow } from '@/storage/db';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Slider } from '@/ui/primitives/Slider';
import { timeAgo } from './format';

interface Base {
  run: RunRow;
  onClose: () => void;
}

export function RenameDialog({ run, onClose, onSave }: Base & { onSave: (name: string) => void }) {
  const [name, setName] = useState(run.name);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Rename run" footer={<Button variant="primary" onClick={() => onSave(name.trim() || run.name)}>Save</Button>}>
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus onKeyDown={(e) => e.key === 'Enter' && onSave(name.trim() || run.name)} />
      </Field>
    </Dialog>
  );
}

/** Picks the generation whose champion seeds a new run. */
export function BranchDialog({ run, onClose, onBranch }: Base & { onBranch: (generation: number) => void }) {
  const last = Math.max(0, run.generation - 1);
  const [gen, setGen] = useState(last);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Branch from a generation"
      description="Starts a new run from that generation's champion. Nothing in this run changes."
      footer={<Button variant="primary" onClick={() => onBranch(gen)}>Create branch</Button>}
    >
      <Field label={`Generation ${gen + 1} of ${run.generation}`}>
        <Slider label="Generation" min={0} max={last} value={gen} onChange={setGen} />
      </Field>
    </Dialog>
  );
}

/** Lists the kept checkpoints and rewinds to the chosen one. */
export function RewindDialog({ run, onClose, onRewind }: Base & { onRewind: (generation: number) => void }) {
  const [cps, setCps] = useState<CheckpointRow[] | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    void listCheckpoints(run.id).then((list) => {
      setCps(list);
      setPick(list[list.length - 1]?.generation ?? null);
    });
  }, [run.id]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Rewind to a checkpoint"
      description="Generations after the checkpoint are removed. The run as it is now stays in Trash for 7 days."
      footer={<Button variant="primary" disabled={pick === null} onClick={() => pick !== null && onRewind(pick)}>Rewind</Button>}
    >
      {cps && cps.length === 0 && <p className="text-[13px] text-muted">No checkpoints yet. One is saved every 10 generations and whenever you pause.</p>}
      <div className="flex flex-col gap-2">
        {cps?.map((c) => (
          <button
            key={c.generation}
            onClick={() => setPick(c.generation)}
            className={cn('flex justify-between rounded-md border px-3 py-2 text-left text-[13px]', pick === c.generation ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
          >
            <span>Generation {c.generation + 1}</span>
            <span className="text-muted">{timeAgo(c.createdAt)}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export function ConfirmDialog({ title, body, action, danger, onClose, onConfirm }: { title: string; body: string; action: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description={body} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{action}</Button></>}>
      <span className="sr-only">{body}</span>
    </Dialog>
  );
}

/** Wipes everything. Requires typing a phrase, since it cannot be undone. */
export function DeleteAllDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState('');
  const phrase = 'delete everything';
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Delete all data"
      description="Removes every run, script, blueprint and cache from this browser. This cannot be undone."
      footer={<Button variant="danger" disabled={text !== phrase} onClick={onConfirm}>Delete all data</Button>}
    >
      <Field label={`Type "${phrase}" to confirm`}>
        <TextInput value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Field>
    </Dialog>
  );
}
