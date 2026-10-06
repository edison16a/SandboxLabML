'use client';

import { useMemo, useState } from 'react';
import { Switch } from '@/ui/primitives/Switch';
import type { TickLog } from './types';

const ROW = 24;
const HEIGHT = 288;

interface Row {
  tick: number;
  events: string;
}

/**
 * Every tick of the run in a fixed height table. Only the rows in view are
 * drawn, since a full minute is 1800 rows. A switch narrows it to the
 * ticks where points were given or something happened.
 */
export function TickTable({ log }: { log: TickLog }) {
  const [onlyEvents, setOnlyEvents] = useState(true);
  const [top, setTop] = useState(0);
  const rows = useMemo<Row[]>(() => {
    const events = new Map<number, string[]>();
    for (const e of log.events) events.set(e.tick, [...(events.get(e.tick) ?? []), e.text]);
    const out: Row[] = [];
    for (let t = 0; t < log.time.length; t++) {
      const ev = events.get(t);
      if (onlyEvents && !ev && Math.abs(log.reward[t]) < 1e-9) continue;
      out.push({ tick: t, events: ev?.join(', ') ?? '' });
    }
    return out;
  }, [log, onlyEvents]);
  const first = Math.max(0, Math.floor(top / ROW) - 4);
  const visible = rows.slice(first, first + Math.ceil(HEIGHT / ROW) + 8);
  const fmt = (n: number, d = 2) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(d));

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 self-end text-[12px] text-muted">
        Only ticks with points or events
        <Switch checked={onlyEvents} onChange={setOnlyEvents} label="Only ticks with points or events" />
      </label>
      <div className="rounded-md border border-border text-[12px]" role="table" aria-label="Ticks" aria-rowcount={rows.length}>
        <div role="row" className="grid grid-cols-[56px_64px_64px_60px_1fr] gap-2 border-b border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-subtle">
          <span role="columnheader">Time</span>
          <span role="columnheader">Reward</span>
          <span role="columnheader">Total</span>
          <span role="columnheader">Speed</span>
          <span role="columnheader">Events</span>
        </div>
        <div className="relative overflow-y-auto" style={{ height: Math.min(HEIGHT, Math.max(ROW, rows.length * ROW)) }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
          <div style={{ height: rows.length * ROW }}>
            {visible.map((r, i) => (
              <div
                key={r.tick}
                role="row"
                className="tabular absolute inset-x-0 grid grid-cols-[56px_64px_64px_60px_1fr] items-center gap-2 border-b border-border/60 px-2 font-mono"
                style={{ top: (first + i) * ROW, height: ROW }}
              >
                <span role="cell" className="text-muted">
                  {log.time[r.tick].toFixed(2)} s
                </span>
                <span role="cell" className={log.reward[r.tick] > 0 ? 'text-success' : log.reward[r.tick] < 0 ? 'text-danger' : 'text-subtle'}>
                  {fmt(log.reward[r.tick], 3)}
                </span>
                <span role="cell">{fmt(log.total[r.tick])}</span>
                <span role="cell" className="text-muted">
                  {log.speed[r.tick].toFixed(1)}
                </span>
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
  );
}
