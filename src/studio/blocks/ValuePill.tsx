'use client';

import { useState } from 'react';
import { entriesByName, formatNumber, type ScriptBlock } from '@/engine/script';
import { cn } from '@/ui/cn';
import { Popover } from '@/ui/primitives/Popover';
import { useBlocks } from './BlocksContext';
import { CallParts } from './CallParts';
import { PillPopover } from './editors/PillPopover';
import { currentDrag, endDrag, isValueBlock } from './model/drag';
import type { PaletteScope } from './model/palette';
import { fillSlot, slotPath, type Slot } from './model/slots';
import { isEmptySlot, signedNumber } from './model/valueBlocks';

interface Props {
  block: ScriptBlock | null;
  slot: Slot;
  scope: PaletteScope;
}

const LEAF = 'inline-flex h-6 items-center rounded-full border px-2 font-mono text-[12px] leading-none whitespace-nowrap transition-colors';

function leafText(b: ScriptBlock, label: (name: string) => string): { text: string; tone: string; title?: string } {
  const f = b.fields;
  switch (b.type) {
    case 'number':
      return { text: `${formatNumber(Number(f.value))}${f.unit === '%' ? '%' : f.unit ? ` ${String(f.unit)}` : ''}`, tone: 'text-orange' };
    case 'text':
      return { text: `"${String(f.value)}"`, tone: 'text-success' };
    case 'boolean':
      return { text: String(f.value), tone: 'text-accent' };
    case 'name':
      return { text: label(String(f.name)), tone: 'text-fg font-sans', title: String(f.name) };
    default:
      return { text: b.type, tone: 'text-muted' };
  }
}

/**
 * One value slot drawn as a pill. Plain values (numbers, names, text) are
 * a single pill; operators and calls draw their parts as nested pills, and
 * their operator word opens the editor for the whole expression. Every
 * pill also takes value blocks dragged from the palette.
 */
export function ValuePill({ block, slot, scope }: Props) {
  const { env, readOnly, apply } = useBlocks();
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const label = (name: string) => entriesByName(env).get(name)?.block.label ?? name;
  const empty = isEmptySlot(block);
  const path = slotPath(slot);

  const drop = {
    onDragOver: (e: React.DragEvent) => {
      const d = currentDrag();
      if (readOnly || !d || d.kind !== 'palette' || !isValueBlock(d.block)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      const d = currentDrag();
      setOver(false);
      if (!d || d.kind !== 'palette' || !isValueBlock(d.block)) return;
      e.preventDefault();
      e.stopPropagation();
      endDrag();
      apply((ws) => fillSlot(ws, slot, structuredClone(d.block)));
    },
  };
  const ring = over ? 'ring-2 ring-accent' : '';

  const trigger = (content: React.ReactNode, className: string, title?: string) =>
    readOnly ? (
      <span className={className} title={title}>
        {content}
      </span>
    ) : (
      <Popover open={open} onOpenChange={setOpen} className="w-80" trigger={<button type="button" className={cn(className, 'cursor-pointer hover:border-border-strong')} title={title} aria-label={`Edit ${slot.hint}`}>{content}</button>}>
        <PillPopover block={block} slot={slot} scope={scope} onDone={() => setOpen(false)} />
      </Popover>
    );

  if (empty || !block) {
    return (
      <span {...drop} className={cn('inline-flex rounded-full', ring)}>
        {trigger(slot.hint, cn(LEAF, 'border-dashed border-border-strong bg-transparent font-sans text-subtle italic'))}
      </span>
    );
  }

  const signed = signedNumber(block);
  if (signed) {
    const unit = signed.unit === '%' ? '%' : signed.unit ? ` ${signed.unit}` : '';
    return (
      <span {...drop} className={cn('inline-flex rounded-full', ring)}>
        {trigger(`${signed.value < 0 ? '-' : signed.plus ? '+' : ''}${formatNumber(Math.abs(signed.value))}${unit}`, cn(LEAF, 'border-border bg-surface-3 text-orange'))}
      </span>
    );
  }

  if (block.type === 'binary' || block.type === 'unary' || block.type === 'callValue' || block.type === 'settings') {
    const op = block.type === 'binary' || block.type === 'unary' ? String(block.fields.op) : block.type === 'settings' ? '{ }' : 'f';
    const kids = (i: number, hint: string): Slot => ({ owner: path ?? slot.owner, name: block.inputs[i]?.name ?? hint, index: i, removable: false, hint });
    return (
      <span {...drop} className={cn('inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface-3/60 px-1 py-0.5', ring)}>
        {block.type === 'unary' && trigger(op, cn(LEAF, 'border-transparent px-1.5 text-accent'))}
        {block.type === 'binary' && <ValuePill block={block.inputs[0]?.block ?? null} slot={kids(0, 'value')} scope={scope} />}
        {block.type === 'binary' && trigger(op, cn(LEAF, 'border-transparent px-1.5 text-accent'), 'Change the operator')}
        {block.type === 'binary' && <ValuePill block={block.inputs[1]?.block ?? null} slot={kids(1, 'value')} scope={scope} />}
        {block.type === 'unary' && <ValuePill block={block.inputs[0]?.block ?? null} slot={kids(0, 'value')} scope={scope} />}
        {(block.type === 'callValue' || block.type === 'settings') && path && (
          <CallParts block={block} path={path} scope={scope} fields={slot.fields} lead={(text) => trigger(text, cn(LEAF, 'border-transparent px-1.5 font-sans text-accent'), 'Change this value')} />
        )}
      </span>
    );
  }

  const leaf = leafText(block, label);
  return (
    <span {...drop} className={cn('inline-flex rounded-full', ring)}>
      {trigger(leaf.text, cn(LEAF, 'border-border bg-surface-3', leaf.tone), leaf.title)}
    </span>
  );
}
