'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/ui/cn';
import { Switch } from '@/ui/primitives/Switch';

const ROW = 24;
const HEIGHT = 288;

/** One number column. Signed columns show points: green above zero, red below. */
export interface TickColumn {
  label: string;
  values: Float32Array;
  digits: number;
  tone?: 'signed' | 'muted';
  /** Column width in px. */
  width?: number;
}

interface Props {
  time: Float32Array;
  columns: TickColumn[];
  events: ReadonlyArray<{ tick: number; text: string }>;
  /** Ticks the narrowed view keeps besides those with events, such as ticks that gave points. */
  notable?: (tick: number) => boolean;
  filterLabel: string;
  /** Narrowest the table gets before it scrolls sideways, so a wide one stays readable on a phone. */
  minWidth?: number;
}

interface Row {
  tick: number;
  events: string;
}

const fmt = (n: number, d: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(d));
const toneOf = (c: TickColumn, v: number) => (c.tone === 'signed' ? (v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-subtle') : c.tone === 'muted' ? 'text-muted' : '');

/**
 * Every tick of the run in a fixed height table. Only the rows in view are
 * drawn, since a full minute is 1800 rows. A switch narrows it to the
 * ticks where something happened.
 */
export function TickTable({ time, columns, events, notable, filterLabel, minWidth }: Props) {
  const [onlyEvents, setOnlyEvents] = useState(true);
  const [top, setTop] = useState(0);
  const rows = useMemo<Row[]>(() => {
    const byTick = new Map<number, string[]>();
    for (const e of events) byTick.set(e.tick, [...(byTick.get(e.tick) ?? []), e.text]);
    const out: Row[] = [];
    for (let t = 0; t < time.length; t++) {
      const ev = byTick.get(t);
      if (onlyEvents && !ev && !notable?.(t)) continue;
      out.push({ tick: t, events: ev?.join(', ') ?? '' });
    }
    return out;
  }, [time, events, notable, onlyEvents]);
  const first = Math.max(0, Math.floor(top / ROW) - 4);
  const visible = rows.slice(first, first + Math.ceil(HEIGHT / ROW) + 8);
  const grid = { gridTemplateColumns: `56px ${columns.map((c) => `${c.width ?? 64}px`).join(' ')} minmax(0, 1fr)` };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 self-end text-[12px] text-muted">
        {filterLabel}
        <Switch checked={onlyEvents} onChange={setOnlyEvents} label={filterLabel} />
      </label>
      <div className="overflow-x-auto rounded-md border border-border">
        <div className="text-[12px]" role="table" aria-label="Ticks" aria-rowcount={rows.length} style={{ minWidth }}>
          <div role="row" className="grid gap-2 border-b border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-subtle" style={grid}>
            <span role="columnheader">Time</span>
            {columns.map((c, i) => (
              <span key={i} role="columnheader">
                {c.label}
              </span>
            ))}
            <span role="columnheader">Events</span>
          </div>
          <div className="relative overflow-y-auto" style={{ height: Math.min(HEIGHT, Math.max(ROW, rows.length * ROW)) }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
            <div style={{ height: rows.length * ROW }}>
              {visible.map((r, i) => (
                <div key={r.tick} role="row" className="tabular absolute inset-x-0 grid items-center gap-2 border-b border-border/60 px-2 font-mono" style={{ ...grid, top: (first + i) * ROW, height: ROW }}>
                  <span role="cell" className="text-muted">
                    {time[r.tick].toFixed(2)} s
                  </span>
                  {columns.map((c, k) => (
                    <span key={k} role="cell" className={cn(toneOf(c, c.values[r.tick]))}>
                      {c.tone === 'muted' ? c.values[r.tick].toFixed(c.digits) : fmt(c.values[r.tick], c.digits)}
                    </span>
                  ))}
                  <span role="cell" className="truncate font-sans text-fg" title={r.events}>
                    {r.events}
                  </span>
                </div>
              ))}
            </div>
            {rows.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-subtle">No points or events in this run.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
