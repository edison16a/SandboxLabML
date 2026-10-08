'use client';

import { useEffect, useState } from 'react';
import type { InputSpec, OutputSpec } from '@/engine/env/types';
import { cn } from '@/ui/cn';
import { isSignedInput } from './signedInputs';

interface Props {
  schema: InputSpec[];
  outputs: OutputSpec[];
  /** Latest observation and action of the inspected agent. */
  read: () => { obs: Float32Array; out: Float32Array } | null;
  hovered: number | null;
  onHover: (index: number | null) => void;
  /** Only show non-ray inputs, for the compact card over the viewport. */
  compact?: boolean;
  /** Inputs switched off by a lesion test, drawn struck through. */
  lesioned?: ReadonlySet<number>;
  onToggleLesion?: (index: number) => void;
}

function display(spec: InputSpec, v: number): string {
  const real = v * spec.scale + spec.offset;
  const digits = Math.abs(real) >= 100 ? 0 : Math.abs(real) >= 10 ? 1 : 2;
  return `${real.toFixed(digits)}${spec.unit ? ` ${spec.unit}` : ''}`;
}

/**
 * Live input and output values as small bars, generated from the input
 * schema so every environment and custom sensor gets the same treatment.
 */
export function InputBars({ schema, outputs, read, hovered, onHover, compact = false, lesioned, onToggleLesion }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  void tick;
  const data = read();
  const rows = compact ? schema.filter((s) => s.group !== 'ray') : schema;
  // The compact card over the viewport is narrow, so its bars give the labels room to read in full.
  const grid = compact ? 'grid-cols-[1fr_40px_64px]' : 'grid-cols-[1fr_88px_64px]';

  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((spec) => {
        const v = data?.obs[spec.index] ?? 0;
        const signed = isSignedInput(spec);
        const off = lesioned?.has(spec.index);
        return (
          <div
            key={spec.key}
            onPointerEnter={() => onHover(spec.index)}
            onPointerLeave={() => onHover(null)}
            className={cn('grid items-center gap-2 rounded px-1.5 py-1 text-[12px]', grid, hovered === spec.index && 'bg-surface-3')}
          >
            <span className={cn('truncate', off ? 'text-subtle line-through' : 'text-muted')} title={spec.label}>
              {onToggleLesion ? (
                <button className="hover:text-fg" onClick={() => onToggleLesion(spec.index)} title="Switch this input off">
                  {spec.label}
                </button>
              ) : (
                spec.label
              )}
            </span>
            <Bar value={v} signed={signed} tone={spec.group === 'ray' ? 'ray' : spec.group === 'custom' ? 'custom' : 'scalar'} />
            <span className="tabular text-right font-mono text-[11px] whitespace-nowrap text-fg">{data ? display(spec, v) : '-'}</span>
          </div>
        );
      })}
      <div className="mt-2 border-t border-border pt-2">
        {outputs.map((o) => (
          <div key={o.key} className={cn('grid items-center gap-2 px-1.5 py-1 text-[12px]', grid)}>
            <span className="font-medium text-fg">{o.label}</span>
            <Bar value={data?.out[o.index] ?? 0} signed tone="output" />
            <span className="tabular text-right font-mono text-[11px]">{data ? (data.out[o.index] ?? 0).toFixed(2) : '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, signed, tone }: { value: number; signed: boolean; tone: 'ray' | 'scalar' | 'custom' | 'output' }) {
  const color = { ray: 'bg-success', scalar: 'bg-accent', custom: 'bg-warn', output: value >= 0 ? 'bg-accent' : 'bg-orange' }[tone];
  const v = Math.max(-1, Math.min(1, value));
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3">
      {signed ? (
        <div className={cn('absolute top-0 h-full', color)} style={{ left: `${50 + Math.min(0, v) * 50}%`, width: `${Math.abs(v) * 50}%` }} />
      ) : (
        <div className={cn('h-full', color)} style={{ width: `${Math.max(0, v) * 100}%` }} />
      )}
      {signed && <div className="absolute top-0 left-1/2 h-full w-px bg-border-strong" />}
    </div>
  );
}
