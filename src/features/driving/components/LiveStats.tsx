'use client';

import { useEffect, useState } from 'react';
import { STATUS_ARRIVED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { drivingLevel } from '@/engine/driving/levels';
import { DRIVING_SNAPSHOT, LF_RAN_RED, LF_WRONG_WAY, SNAP } from '@/engine/driving/snapshotLayout';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { cn } from '@/ui/cn';
import { isWatchSpeed } from '@/workers/shared/protocol';
import { useDrivingLab } from '../state/labStore';

const STRIDE = DRIVING_SNAPSHOT.stride;

interface Live {
  total: number;
  driving: number;
  arrived: number;
  violations: number;
  speed: number;
}

const NONE: Live = { total: 0, driving: 0, arrived: 0, violations: 0, speed: 0 };

/** Reads the shown stream four times a second for the chips: who is driving, who arrived, who broke a rule, and the followed SUV's speed. */
function useLive(stream: SnapshotStream | null): Live {
  const [live, setLive] = useState<Live>(NONE);
  useEffect(() => {
    const id = setInterval(() => {
      const buf = stream?.curr?.buffer;
      if (!buf || !stream) return setLive((l) => (l.total === 0 ? l : NONE));
      const next = { total: stream.count, driving: 0, arrived: 0, violations: 0, speed: 0 };
      for (let i = 0; i < stream.count; i++) {
        const o = i * STRIDE;
        const status = buf[o + SNAP.status];
        if (status === STATUS_DRIVING) next.driving++;
        if (status === STATUS_ARRIVED) next.arrived++;
        // A red light run stays on the record; the wrong side counts while it lasts.
        const flags = buf[o + SNAP.flags];
        if (flags & LF_RAN_RED || (status === STATUS_DRIVING && flags & LF_WRONG_WAY)) next.violations++;
      }
      const followed = useDrivingLab.getState().followed;
      if (followed >= 0 && followed < stream.count) next.speed = buf[followed * STRIDE + SNAP.speed];
      setLive(next);
    }, 250);
    return () => clearInterval(id);
  }, [stream]);
  return live;
}

/** One HUD number. `wide` ones only show from tablet width up, so a phone keeps two rows of chips. */
function Chip({ label, value, tour, title, wide }: { label: string; value: React.ReactNode; tour?: string; title?: string; wide?: boolean }) {
  return (
    <div data-tour={tour} title={title} className={cn('flex flex-col rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 leading-tight backdrop-blur-sm', wide && 'max-sm:hidden')}>
      <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">{label}</span>
      <span className="tabular font-mono text-[14px] font-semibold text-white">{value}</span>
    </div>
  );
}

const percent = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : `${Math.round(v * 100)}%`);

/**
 * Generation, level and trip, then the live numbers while a generation
 * plays at a watch speed (driving, arrived, rule breaks, speed), or the
 * last generation's shares while Turbo and Max train out of sight.
 */
export function LiveStats({ stream, shown }: { stream: SnapshotStream | null; shown: 'population' | 'ghosts' }) {
  const live = useLive(stream);
  const gen = useDrivingLab((s) => s.liveGeneration);
  const level = useDrivingLab((s) => (shown === 'ghosts' ? (s.ghostContent ?? s.content) : s.content)?.level);
  const trip = useDrivingLab((s) => s.trip);
  const trips = useDrivingLab((s) => s.trips);
  const last = useDrivingLab((s) => s.records[s.records.length - 1]);
  const watching = useDrivingLab((s) => s.status === 'running' && isWatchSpeed(s.speed) && s.mode === 'train');
  return (
    <div className="pointer-events-none flex flex-wrap gap-1.5">
      <Chip label="Generation" value={gen + 1} tour="hud-generation" />
      {level !== undefined && <Chip label="Level" value={`${level} ${drivingLevel(level).name}`} tour="hud-level" />}
      {trips > 1 && live.total > 0 && <Chip label="Trip" value={`${trip + 1} of ${trips}`} />}
      {watching && live.total > 0 && <Chip label="Driving" value={`${live.driving} / ${live.total}`} />}
      {watching && live.total > 0 && <Chip label="Arrived" value={percent(live.arrived / live.total)} />}
      {watching && live.total > 0 && <Chip label="Violations" value={live.violations} title="Ran a red light, or on the wrong side of the road" wide />}
      {watching && live.total > 0 && <Chip label="Speed" value={`${Math.round(live.speed * 3.6)} km/h`} />}
      {!watching && last && <Chip label="Arrived" value={percent(last.metrics?.arrived)} title="Share of last generation's trips that arrived" />}
      {!watching && last && <Chip label="Safe" value={percent(last.metrics?.safe)} title="Arrived with no crash and no red light run" />}
    </div>
  );
}
