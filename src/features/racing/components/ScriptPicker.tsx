'use client';

import { useMemo } from 'react';
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

/** Compiles a preset into the shape a new run stores. Presets always compile; a test guards that. */
export function choiceFromPreset(p: ScriptPreset): ScriptChoice | null {
  const { script } = compileScript(p.source);
  if (!script) return null;
  const bp = script.header.brain ? findPresetBlueprint(script.header.brain) : undefined;
  return {
    kind: 'script',
    id: p.id,
    name: `${p.name} script`,
    compiled: { source: p.source, hash: script.sourceHash, customSensors: script.sensors.length },
    blueprint: bp?.env === 'racing' ? bp : undefined,
  };
}

/** Picks the training script for a new run: the built-in reward or one of the preset scripts. */
export function ScriptPicker({ value, onChange }: { value: ScriptChoice; onChange: (v: ScriptChoice) => void }) {
  const presets = useMemo(() => RACING_PRESETS.map((p) => ({ preset: p, choice: choiceFromPreset(p) })), []);
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
      </div>
    </Field>
  );
}

function Option({ active, icon, title, body, onClick }: { active: boolean; icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex flex-col items-start gap-1 rounded-md border p-2.5 text-left [&_svg]:size-3.5', active ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        {icon}
        {title}
      </span>
      <span className="line-clamp-3 text-[11px] text-muted">{body}</span>
    </button>
  );
}
