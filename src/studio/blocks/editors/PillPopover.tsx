'use client';

import { useState } from 'react';
import type { ScriptBlock, UnitName } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { TextInput } from '@/ui/primitives/Field';
import { useBlocks } from '../BlocksContext';
import type { PaletteScope } from '../model/palette';
import { fillSlot, type Slot } from '../model/slots';
import { boolBlock, callValueBlock, isEmptySlot, nameBlock, opFamily, signedNumber, signedNumberBlock } from '../model/valueBlocks';
import { FunctionPicker } from './FunctionPicker';
import { NamePicker } from './NamePicker';
import { NumberEditor } from './NumberEditor';
import { OperatorPicker } from './OperatorPicker';
import { ReplaceMenu, type ReplaceMode } from './ReplaceMenu';

interface Props {
  block: ScriptBlock | null;
  slot: Slot;
  scope: PaletteScope;
  onDone: () => void;
}

function TextEditor({ value, choices, onApply }: { value: string; choices?: readonly string[]; onApply: (v: string) => void }) {
  const [text, setText] = useState(value);
  if (choices && choices.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => (
          <Button key={c} size="sm" variant={c === value ? 'primary' : 'outline'} onClick={() => onApply(c)}>
            {c}
          </Button>
        ))}
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(text);
      }}
    >
      <TextInput autoFocus aria-label="Text" value={text} onChange={(e) => setText(e.target.value)} className="min-w-0 flex-1" />
      <Button type="submit" variant="primary">
        Set
      </Button>
    </form>
  );
}

/**
 * What opens when a pill is clicked: an editor for the kind of value in
 * the slot (number and unit, sensor, operator, text), and below it the
 * choices to change the slot into something else.
 */
export function PillPopover({ block, slot, scope, onDone }: Props) {
  const { env, apply, locals } = useBlocks();
  const [mode, setMode] = useState<ReplaceMode | 'edit'>('edit');
  const put = (next: ScriptBlock | null) => {
    apply((ws) => fillSlot(ws, slot, next));
    onDone();
  };
  const keep = block && !isEmptySlot(block) ? structuredClone(block) : null;

  if (mode === 'name' || (mode === 'edit' && block?.type === 'name' && !isEmptySlot(block))) {
    return <NamePicker env={env} scope={scope} locals={locals} onPick={(n) => put(nameBlock(n))} />;
  }
  if (mode === 'function') return <FunctionPicker env={env} scope={scope} onPick={(e) => put(callValueBlock(e, keep))} />;

  let editor: React.ReactNode = null;
  const signed = signedNumber(block);
  if (signed) {
    editor = <NumberEditor value={signed.value} unit={signed.unit} onApply={(v, u) => put(signedNumberBlock(v, u, signed.plus))} />;
  } else if (block && !isEmptySlot(block)) {
    const f = block.fields;
    if (block.type === 'number') editor = <NumberEditor value={Number(f.value)} unit={String(f.unit) as UnitName} onApply={(v, u) => put(signedNumberBlock(v, u, false))} />;
    else if (block.type === 'text') editor = <TextEditor value={String(f.value)} choices={slot.choices} onApply={(v) => put({ ...block, fields: { value: v } })} />;
    else if (block.type === 'boolean') {
      editor = (
        <div className="flex gap-1.5">
          <Button size="sm" variant={f.value === true ? 'primary' : 'outline'} onClick={() => put(boolBlock(true))}>
            true
          </Button>
          <Button size="sm" variant={f.value === false ? 'primary' : 'outline'} onClick={() => put(boolBlock(false))}>
            false
          </Button>
        </div>
      );
    } else if (block.type === 'binary') editor = <OperatorPicker value={String(f.op)} options={opFamily(String(f.op))} onPick={(op) => put({ ...block, fields: { op } })} />;
    else if (block.type === 'unary') {
      editor = (
        <div className="flex flex-col gap-2">
          <OperatorPicker value={String(f.op)} options={['not', '-']} onPick={(op) => put({ ...block, fields: { op } })} />
          <Button size="sm" variant="outline" onClick={() => put(block.inputs[0]?.block ?? null)}>
            Keep only the inside
          </Button>
        </div>
      );
    }
  } else if (slot.choices && slot.choices.length > 0) {
    editor = <TextEditor value="" choices={slot.choices} onApply={(v) => put({ id: 'new-text', type: 'text', fields: { value: v }, inputs: [], children: {}, comment: null })} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {editor}
      {editor && <div className="h-px bg-border" />}
      <ReplaceMenu current={block} removable={slot.removable} onMode={setMode} onReplace={put} />
    </div>
  );
}
