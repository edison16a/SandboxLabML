'use client';

import { useEffect, useState } from 'react';
import type { Blueprint } from '@/engine/blueprints/types';
import type { RunConfig } from '@/engine/training/runConfig';
import { ScriptPicker } from '@/features/scripts/ScriptPicker';
import type { BlueprintOf, ScriptChoice } from '@/features/scripts/scriptChoice';
import { setSetting } from '@/storage/settings';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { useLabContext } from '../LabContext';
import { BlueprintField } from './BlueprintField';

/** What the shared fields of a new run come to, for the lab to build its run config from. */
export interface NewRunBasics<B extends Blueprint> {
  name: string;
  seed: number;
  /** The script's own brain when it names one, else the picked blueprint. */
  blueprint: B;
  populationSize: number;
  script?: { source: string; hash: string; customSensors: number };
}

type Population = '50' | '100' | '150';

interface Props<B extends Blueprint> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The preset brain the picker starts on. */
  defaultBlueprint: B;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice<B>;
  /** The lab's own fields between the name and the script, such as the city. */
  children?: React.ReactNode;
  /** A lab field beside population and seed. */
  besideSeed?: React.ReactNode;
  build: (basics: NewRunBasics<B>) => RunConfig;
}

/**
 * The bones of every lab's new run dialog: name, the lab's own fields,
 * the training script, the brain, population and seed. Everything here is
 * frozen at run creation; changing any of it later means a new run. Create
 * opens the run, remembers it and starts training.
 */
export function NewRunShell<B extends Blueprint>({ open, onOpenChange, title, defaultBlueprint, initialScript, children, besideSeed, build }: Props<B>) {
  const { env, session, lastRunKey } = useLabContext();
  const [name, setName] = useState('New run');
  const [blueprint, setBlueprint] = useState<B>(defaultBlueprint);
  const [pop, setPop] = useState<Population>('100');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [script, setScript] = useState<ScriptChoice<B>>({ kind: 'builtin' });
  const [busy, setBusy] = useState(false);
  // The brain's customize dialog takes this one's place while it is open.
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (open && initialScript) {
      setScript(initialScript);
      if (initialScript.kind === 'script') setName(initialScript.name);
    }
  }, [open, initialScript]);

  const create = async () => {
    setBusy(true);
    const config = build({
      name: name.trim() || 'Untitled run',
      seed,
      blueprint: script.kind === 'script' && script.blueprint ? script.blueprint : blueprint,
      populationSize: Number(pop),
      script: script.kind === 'script' ? script.compiled : undefined,
    });
    await session.newRun(config);
    await setSetting(lastRunKey, config.id);
    setBusy(false);
    onOpenChange(false);
    void session.start();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Fixed once the run starts."
      className="max-w-2xl"
      covered={open && covered}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={busy}>
            Create and train
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        {children}
        {/* The picker hands back the blueprint type of the lab's env, which is B. */}
        <ScriptPicker env={env} value={script as ScriptChoice<BlueprintOf<typeof env>>} onChange={(v) => setScript(v as ScriptChoice<B>)} />
        {script.kind === 'builtin' && <BlueprintField open={open} value={blueprint} onChange={setBlueprint} onEditingChange={setCovered} />}
        <div className={besideSeed ? 'grid grid-cols-1 gap-4 sm:grid-cols-3' : 'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
          {besideSeed}
          <Field label="Population">
            <Segmented label="Population size" value={pop} onChange={setPop} options={[{ value: '50', label: '50' }, { value: '100', label: '100' }, { value: '150', label: '150' }]} />
          </Field>
          <Field label="Seed" hint="Same seed, same results.">
            <TextInput type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
