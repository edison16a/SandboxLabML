'use client';

import { entriesFor, type ScriptBlock } from '@/engine/script';
import { useBlocks } from './BlocksContext';
import { CallParts, Word } from './CallParts';
import { InlineField } from './editors/InlineField';
import type { PaletteScope } from './model/palette';
import type { BlockPath } from './model/paths';
import { updateBlock } from './model/ops';
import { fillSlot, type Slot } from './model/slots';
import { nameBlock } from './model/valueBlocks';
import { ValuePill } from './ValuePill';

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function Keyword({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-semibold whitespace-nowrap text-fg">{children}</span>;
}

/**
 * The first line of a statement block: its words, fields and value pills.
 * Each statement kind lays itself out like the line of SBL it stands for,
 * so reading the blocks teaches the text.
 */
export function BlockHead({ block, path, scope }: { block: ScriptBlock; path: BlockPath; scope: PaletteScope }) {
  const { env, readOnly, apply } = useBlocks();
  const f = block.fields;
  const setField = (key: string, value: string | number) => apply((ws) => updateBlock(ws, path, (b) => ({ ...b, fields: { ...b.fields, [key]: value } })));
  const input = (name: string, hint: string, removable = false) => {
    const index = block.inputs.findIndex((i) => i.name === name);
    const slot: Slot = { owner: path, name, index: index === -1 ? null : index, removable, hint };
    return <ValuePill block={index === -1 ? null : block.inputs[index].block} slot={slot} scope={scope} />;
  };

  switch (block.type) {
    case 'let':
      return (
        <>
          <Keyword>let</Keyword>
          <InlineField label="Name" value={String(f.name)} pattern={NAME} readOnly={readOnly} onCommit={(v) => setField('name', v)} />
          <Word>=</Word>
          {input('value', 'value')}
        </>
      );
    case 'reward': {
      const when = block.inputs.find((i) => i.name === 'when')?.block ?? null;
      return (
        <>
          <Keyword>reward</Keyword>
          {input('value', 'points')}
          {when ? <Word>when</Word> : <Word>every tick</Word>}
          {when && input('when', 'condition', true)}
          {!when && !readOnly && (
            <button
              type="button"
              onClick={() => apply((ws) => fillSlot(ws, { owner: path, name: 'when', index: block.inputs.findIndex((i) => i.name === 'when'), removable: false, hint: 'condition' }, nameBlock('_')))}
              className="rounded-full border border-dashed border-border-strong px-2 text-[12px] text-subtle hover:text-fg"
            >
              add when
            </button>
          )}
        </>
      );
    }
    case 'stop':
      return (
        <>
          <Keyword>stop</Keyword>
          <InlineField label="Reason" quoted value={String(f.reason)} readOnly={readOnly} onCommit={(v) => setField('reason', v)} />
          <Word>when</Word>
          {input('when', 'condition')}
        </>
      );
    case 'if':
      return (
        <>
          <Keyword>if</Keyword>
          {input('cond', 'condition')}
        </>
      );
    case 'repeat':
      return (
        <>
          <Keyword>repeat</Keyword>
          <InlineField label="Times" numeric value={String(f.count)} pattern={/^\d{1,2}$/} readOnly={readOnly} onCommit={(v) => setField('count', Number(v))} />
          <Word>times</Word>
        </>
      );
    case 'forEach': {
      const lists = entriesFor(env, scope === 'generation' ? 'generation' : 'tick').filter((e) => e.kind === 'collection');
      return (
        <>
          <Keyword>for each</Keyword>
          <InlineField label="Item name" value={String(f.variable)} pattern={NAME} readOnly={readOnly} onCommit={(v) => setField('variable', v)} />
          <Word>in</Word>
          <select
            aria-label="List"
            disabled={readOnly}
            value={String(f.collection)}
            onChange={(e) => setField('collection', e.target.value)}
            className="h-6 rounded-full border border-border bg-surface-3 px-2 font-mono text-[12px] text-fg"
          >
            {[...new Set([String(f.collection), ...lists.map((l) => l.name)])].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </>
      );
    }
    case 'call':
      return <CallParts block={block} path={path} scope={scope} lead={(text) => <Keyword>{text}</Keyword>} />;
    case 'sensor':
      return (
        <>
          <Keyword>sensor</Keyword>
          <InlineField label="Sensor name" value={String(f.name)} pattern={NAME} readOnly={readOnly} onCommit={(v) => setField('name', v)} />
          <InlineField label="Sensor label" quoted value={String(f.label)} readOnly={readOnly} onCommit={(v) => setField('label', v)} />
          <Word>from</Word>
          {input('lo', 'low')}
          <Word>to</Word>
          {input('hi', 'high')}
          <Word>reads</Word>
          {input('value', 'value')}
        </>
      );
    default:
      return input('value', 'value');
  }
}
