'use client';

import { useEffect, useMemo, useState } from 'react';
import { listScripts } from '@/storage/scripts';
import { FileCode2, Sparkles } from 'lucide-react';
import { findPresetBlueprint } from '@/engine/blueprints/presets';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import { compileScript, RACING_PRESETS, type ScriptPreset } from '@/engine/script';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';

/** The reward the run trains with: the built-in reward or a compiled SBL script. */
export type ScriptChoice =
  | { kind: 'builtin' }
  | { kind: 'script'; id: string; name: string; compiled: { source: string; hash: string; customSensors: number }; blueprint?: RacingBlueprint };

/** Compiles a script into the shape a new run stores, or null if it has errors. */
export function choiceFromSource(id: string, name: string, source: string): ScriptChoice | null {
  const { script } = compileScript(source);
  if (!script || script.header.env !== 'racing') return null;
  const bp = script.header.brain ? findPresetBlueprint(script.header.brain) : undefined;
  return {
    kind: 'script',
    id,
    name,
    compiled: { source, hash: script.sourceHash, customSensors: script.sensors.length },
    blueprint: bp?.env === 'racing' ? bp : undefined,
  };
}

/** Presets always compile; a test guards that. */
export function choiceFromPreset(p: ScriptPreset): ScriptChoice | null {
  return choiceFromSource(p.id, `${p.name} script`, p.source);
}

/** Picks the training script for a new run: the built-in reward or one of the preset scripts. */
export function ScriptPicker({ value, onChange }: { value: ScriptChoice; onChange: (v: ScriptChoice) => void }) {
  const presets = useMemo(() => RACING_PRESETS.map((p) => ({ preset: p, choice: choiceFromPreset(p) })), []);
  const [mine, setMine] = useState<Array<{ id: string; name: string; choice: ScriptChoice | null }>>([]);
  useEffect(() => {
    void listScripts('racing').then((rows) => setMine(rows.slice(0, 8).map((r) => ({ id: r.id, name: r.name, choice: choiceFromSource(r.id, r.name, r.source) }))));
  }, []);
  const selected = value.kind === 'builtin' ? 'builtin' : value.id;
  return (
    <Field label="Training script" hint="A script decides the rewards, when a car stops and how each generation breeds. Edit your own in Studio.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Option active={selected === 'builtin'} icon={<Sparkles />} title="Built-in" body="Checkpoints, laps and a little speed. The fastest path." onClick={() => onChange({ kind: 'builtin' })} />
        {presets.map(({ preset, choice }) =>
          choice ? (
            <Option key={preset.id} active={selected === preset.id} icon={<FileCode2 />} title={preset.name} body={preset.description} onClick={() => onChange(choice)} />
          ) : null,
        )}
        {mine.map(({ id, name, choice }) => (
          <Option
            key={id}
            active={selected === id}
            icon={<FileCode2 />}
            title={name}
            body={choice ? 'Your script from Studio.' : 'Has errors. Fix it in Studio first.'}
            disabled={!choice}
            onClick={() => choice && onChange(choice)}
          />
        ))}
      </div>
    </Field>
  );
}

function Option({ active, icon, title, body, onClick, disabled }: { active: boolean; icon: React.ReactNode; title: string; body: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('flex flex-col items-start gap-1 rounded-md border p-2.5 text-left disabled:opacity-50 [&_svg]:size-3.5', active ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        {icon}
        {title}
      </span>
      <span className="line-clamp-3 text-[11px] text-muted">{body}</span>
    </button>
  );
}
