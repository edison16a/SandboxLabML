'use client';

import { Plus } from 'lucide-react';
import { entriesByName, type ParamDef, type ScriptBlock, type UnitName } from '@/engine/script';
import { Menu } from '@/ui/primitives/Menu';
import { useBlocks } from './BlocksContext';
import type { PaletteScope } from './model/palette';
import type { BlockPath } from './model/paths';
import { fillSlot, type Slot } from './model/slots';
import { boolBlock, numberBlock, textBlock } from './model/valueBlocks';
import { ValuePill } from './ValuePill';

interface Props {
  block: ScriptBlock;
  path: BlockPath;
  scope: PaletteScope;
  /** Renders the first words of the label, so a value call can make them its edit button. */
  lead?: (text: string) => React.ReactNode;
  /** Field definitions when the block is a settings record. */
  fields?: readonly ParamDef[];
}

export function Word({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] whitespace-nowrap text-muted">{children}</span>;
}

/** A value to start an optional argument with: its default, so adding it changes nothing until edited. */
function defaultBlock(p: ParamDef): ScriptBlock {
  if (p.type === 'bool') return boolBlock(p.default === undefined ? true : p.default === true);
  if (p.type === 'string') return textBlock(String(p.default ?? p.choices?.[0] ?? ''));
  if (p.type === 'record') return { id: 'new-settings', type: 'settings', fields: {}, inputs: [], children: {}, comment: null };
  const unit = p.unit === '*' ? '' : (p.unit as UnitName);
  return numberBlock(Number(p.default ?? 0), unit);
}

/**
 * The parts of a call or settings block: the registry label with a pill
 * for each `{param}`, then any arguments the label does not mention, then
 * a button to add optional arguments that are still missing.
 */
export function CallParts({ block, path, scope, lead, fields }: Props) {
  const { env, readOnly, apply } = useBlocks();
  const name = String(block.fields.name ?? '');
  const entry = block.type === 'settings' ? undefined : entriesByName(env).get(name);
  const params = entry?.params ?? fields ?? [];
  const parts: React.ReactNode[] = [];
  const used = new Set<number>();
  const inLabel = new Set<string>();

  const slotFor = (p: ParamDef, k: number): Slot => {
    let index = block.inputs.findIndex((i) => i.name === p.name);
    if (index === -1 && block.inputs[k]?.name === '') index = k;
    const positional = entry !== undefined && params.length === 1;
    return { owner: path, name: index >= 0 ? block.inputs[index].name : positional ? '' : p.name, index: index >= 0 ? index : null, removable: !p.required, hint: p.name, choices: p.choices, fields: p.fields };
  };
  const pill = (slot: Slot, key: string) => <ValuePill key={key} block={slot.index === null ? null : (block.inputs[slot.index]?.block ?? null)} slot={slot} scope={scope} />;

  if (entry) {
    const pieces = entry.block.label.split(/\{(\w+)\}/);
    if (pieces[0].trim() === '' && lead) parts.push(<span key="lead">{lead(name)}</span>);
    pieces.forEach((piece, i) => {
      if (i % 2 === 0) {
        const text = piece.trim();
        if (text) parts.push(<span key={`t${i}`}>{i === 0 && lead ? lead(text) : <Word>{text}</Word>}</span>);
        return;
      }
      const k = params.findIndex((p) => p.name === piece);
      if (k === -1) return;
      inLabel.add(piece);
      const slot = slotFor(params[k], k);
      if (slot.index !== null) used.add(slot.index);
      parts.push(pill(slot, `p${i}`));
    });
  } else if (lead) parts.push(<span key="lead">{lead(block.type === 'settings' ? 'settings' : name)}</span>);

  block.inputs.forEach((input, index) => {
    if (used.has(index) || input.name === '$callee') return;
    const p = params.find((q) => q.name === input.name);
    const slot: Slot = { owner: path, name: input.name, index, removable: p ? !p.required : true, hint: input.name || 'value', choices: p?.choices, fields: p?.fields };
    parts.push(<Word key={`n${index}`}>{input.name || 'value'}</Word>, pill(slot, `i${index}`));
  });

  const missing = params.filter((p) => !p.required && !inLabel.has(p.name) && !block.inputs.some((i) => i.name === p.name));
  if (missing.length > 0 && !readOnly) {
    parts.push(
      <Menu
        key="add"
        align="start"
        trigger={
          <button type="button" aria-label="Add an optional setting" className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border-strong text-subtle hover:text-fg">
            <Plus className="size-3.5" />
          </button>
        }
        items={missing.map((p) => ({ label: `${p.name}: ${p.summary}`, onSelect: () => apply((ws) => fillSlot(ws, { owner: path, name: p.name, index: null, removable: true, hint: p.name }, defaultBlock(p))) }))}
      />,
    );
  }
  return <>{parts}</>;
}
