'use client';

import { useEffect, useState } from 'react';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { blueprintInputCount } from '@/engine/blueprints/shape';
import type { HideSeekBlueprint } from '@/engine/blueprints/types';
import { HIDESEEK_LAYOUT_IDS, HIDESEEK_LAYOUTS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { presetRoom } from '@/engine/hideseek/sandbox/room';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { ScriptPicker } from '@/features/scripts/ScriptPicker';
import type { ScriptChoice } from '@/features/scripts/scriptChoice';
import { setSetting } from '@/storage/settings';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { HS_LAST_RUN_KEY } from '../../hooks/useHideSeekBootstrap';
import { hideSeekSession } from '../../session/HideSeekSession';
import { RoomThumb } from '../maps/RoomThumb';
import { BlueprintPicker } from './BlueprintPicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice<HideSeekBlueprint>;
}

const choice = (selected: boolean) => cn('rounded-md border p-2.5 text-left transition-colors', selected ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong');

/**
 * Everything frozen when a Hide and Seek run starts: script, rooms, brain
 * blueprint, team size, rounds per generation and seed. Changing any of
 * them later means a new run, which is what keeps every round replayable.
 */
export function NewRunDialog({ open, onOpenChange, initialScript }: Props) {
  const [name, setName] = useState('New run');
  const [layouts, setLayouts] = useState<HideSeekLayoutId[]>([...HIDESEEK_LAYOUT_IDS]);
  const [blueprint, setBlueprint] = useState<HideSeekBlueprint>(HIDESEEK_BLUEPRINTS[1]);
  const [pop, setPop] = useState<'20' | '50'>('50');
  const [rounds, setRounds] = useState<'1' | '2' | '3' | '4'>('4');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [script, setScript] = useState<ScriptChoice<HideSeekBlueprint>>({ kind: 'builtin' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && initialScript) {
      setScript(initialScript);
      if (initialScript.kind === 'script') setName(initialScript.name);
    }
  }, [open, initialScript]);
  // A script with a brain line trains that brain, so the blueprint choice steps aside.
  const scriptBrain = script.kind === 'script' ? script.blueprint : undefined;

  const toggleLayout = (id: HideSeekLayoutId) => setLayouts((ls) => (ls.includes(id) ? (ls.length > 1 ? ls.filter((l) => l !== id) : ls) : HIDESEEK_LAYOUT_IDS.filter((l) => l === id || ls.includes(l))));

  const create = async () => {
    setBusy(true);
    const config = createHideSeekRunConfig({
      name: name.trim() || 'Untitled run',
      seed,
      blueprint: scriptBrain ?? blueprint,
      populationPerTeam: Number(pop),
      layouts,
      rounds: Number(rounds),
      script: script.kind === 'script' ? script.compiled : undefined,
    });
    await hideSeekSession().newRun(config);
    await setSetting(HS_LAST_RUN_KEY, config.id);
    setBusy(false);
    onOpenChange(false);
    void hideSeekSession().start();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Hide and Seek run"
      description="These settings are frozen once the run starts, so every round can be replayed exactly."
      className="max-w-2xl"
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
        <ScriptPicker env="hideseek" value={script} onChange={setScript} />
        <Field label="Rooms" hint={script.kind === 'script' ? 'Rounds cycle through these rooms unless the script picks its own.' : 'Rounds cycle through the rooms you pick. Blue and red mark where each team starts.'}>
          <div className="grid grid-cols-3 gap-2">
            {HIDESEEK_LAYOUT_IDS.map((id) => {
              const on = layouts.includes(id);
              return (
                <button key={id} type="button" onClick={() => toggleLayout(id)} className={cn(choice(on), 'flex flex-col items-center gap-1.5')} aria-pressed={on}>
                  <RoomThumb room={presetRoom(id)} className={on ? 'text-fg' : 'text-muted'} />
                  <span className="text-[13px] font-medium">{HIDESEEK_LAYOUTS[id].name}</span>
                  <span className="text-center text-[11px] text-muted">{HIDESEEK_LAYOUTS[id].description}</span>
                </button>
              );
            })}
          </div>
        </Field>
        {scriptBrain ? (
          <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
            This script trains the <span className="font-medium text-fg">{scriptBrain.name}</span> brain, {blueprintInputCount(scriptBrain)} inputs.
          </p>
        ) : (
          <BlueprintPicker open={open} value={blueprint} onChange={setBlueprint} />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Agents per team" hint={pop === '20' ? 'Lighter, for slower machines.' : 'Fills the 50 arena grid.'}>
            <Segmented label="Agents per team" value={pop} onChange={setPop} options={[{ value: '20', label: '20' }, { value: '50', label: '50' }]} />
          </Field>
          <Field label="Rounds per generation" hint="Rounds 3 and 4 play past champions.">
            <Segmented label="Rounds per generation" value={rounds} onChange={setRounds} options={(['1', '2', '3', '4'] as const).map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Seed" hint="Same seed, same results.">
            <TextInput type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
