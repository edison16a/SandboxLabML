'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileCode2, Sparkles } from 'lucide-react';
import type { EnvId } from '@/engine/env/types';
import { listScripts } from '@/storage/scripts';
import { cn } from '@/ui/cn';
import { firstSentence } from '@/ui/firstSentence';
import { Field } from '@/ui/primitives/Field';
import { choiceFromPreset, choiceFromSource, presetsFor, type BlueprintOf, type ScriptChoice } from './scriptChoice';

/** What the built-in option does in each lab, said in one line. */
const BUILTIN: Record<EnvId, string> = {
  racing: 'Checkpoints, laps and a little speed.',
  hideseek: 'Hiders score while unseen, seekers while they see.',
};

/** What a training script is, in one line. */
const HINT = 'Sets the rewards and how each generation breeds.';

interface Props<E extends EnvId> {
  env: E;
  value: ScriptChoice<BlueprintOf<E>>;
  onChange: (v: ScriptChoice<BlueprintOf<E>>) => void;
}

/** Picks the training script for a new run: the built-in reward, a preset or one of your Studio scripts. */
export function ScriptPicker<E extends EnvId>({ env, value, onChange }: Props<E>) {
  const presets = useMemo(() => presetsFor(env).map((p) => ({ preset: p, choice: choiceFromPreset(env, p) })), [env]);
  const [mine, setMine] = useState<Array<{ id: string; name: string; choice: ScriptChoice<BlueprintOf<E>> | null }>>([]);
  useEffect(() => {
    void listScripts(env).then((rows) => setMine(rows.slice(0, 8).map((r) => ({ id: r.id, name: r.name, choice: choiceFromSource(env, r.id, r.name, r.source) }))));
  }, [env]);
  const selected = value.kind === 'builtin' ? 'builtin' : value.id;
  return (
    <Field label="Training script" hint={HINT}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Option active={selected === 'builtin'} icon={<Sparkles />} title="Built-in" body={BUILTIN[env]} onClick={() => onChange({ kind: 'builtin' })} />
        {presets.map(({ preset, choice }) =>
          choice ? (
            <Option key={preset.id} active={selected === preset.id} icon={<FileCode2 />} title={preset.name} body={firstSentence(preset.description)} onClick={() => onChange(choice)} />
          ) : null,
        )}
        {mine.map(({ id, name, choice }) => (
          <Option
            key={id}
            active={selected === id}
            icon={<FileCode2 />}
            title={name}
            body={choice ? 'Your script' : 'Has errors. Fix it in Studio first.'}
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
      aria-pressed={active}
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
