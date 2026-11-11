'use client';

import { useMemo } from 'react';
import { DRIVING_LEVELS, drivingLevel } from '@/engine/driving/levels';
import type { DrivingContent } from '@/engine/driving/run/content';
import type { GenerationRecord } from '@/engine/training/records';
import { Section } from '@/features/lab/components/Section';
import { cn } from '@/ui/cn';
import { useDrivingLab } from '../state/labStore';
import { SeriesChart, type Series } from './SeriesChart';

const share = (v: number) => `${Math.round(v * 100)}%`;
const LEVEL_TICKS = DRIVING_LEVELS.map((l) => l.id);
/** Generations each arrival and safety line averages over; the raw values stay faint behind it. */
const SMOOTH = 5;
const COLORS = { level: '#4c9aff', arrived: '#4c9aff', safe: '#3dd68c', elite: '#ff9f43', crash: '#ff5f5f', people: '#ff6fb8', offRoad: '#f5c451', red: '#ff8a5c' };

/** One metric of every record, NaN and missing as gaps. */
function column(records: readonly GenerationRecord[], key: string): Array<number | null> {
  return records.map((r) => {
    const v = r.metrics?.[key];
    return v === undefined || !Number.isFinite(v) ? null : v;
  });
}

/** Generations (1 based) whose level differs from the one before, where the charts mark a level change. */
function levelChanges(records: readonly GenerationRecord[]): number[] {
  const marks: number[] = [];
  for (let i = 1; i < records.length; i++) if (records[i].metrics?.level !== records[i - 1].metrics?.level) marks.push(records[i].generation + 1);
  return marks;
}

/** The five levels, the one being driven now highlighted and the ones reached so far in full color. */
function LevelSteps({ now, best }: { now: number; best: number }) {
  return (
    <ol className="grid grid-cols-5 gap-1 text-[10px] leading-tight">
      {DRIVING_LEVELS.map((l) => (
        <li key={l.id} className={cn('rounded border px-1.5 py-1', l.id === now ? 'border-accent/60 bg-accent-soft text-fg' : l.id <= best ? 'border-border text-muted' : 'border-border/60 text-subtle')}>
          <span className="tabular block font-mono">{l.id}</span>
          {l.name}
        </li>
      ))}
    </ol>
  );
}

/**
 * Driving's own Progress charts: the curriculum's level per generation,
 * how many trips arrive (everyone, safely, and the best fifth that moves the
 * level up), and how trips end badly. A faint dashed line marks every level
 * change, so a dip in arrivals lines up with the harder level that caused it.
 */
export function DrivingProgress() {
  const records = useDrivingLab((s) => s.records);
  const content = useDrivingLab((s) => s.content);
  const marks = useMemo(() => levelChanges(records), [records]);
  const x = useMemo(() => records.map((r) => r.generation + 1), [records]);
  const levels = useMemo(() => column(records, 'level'), [records]);
  const arrivals = useMemo<Series[]>(() => {
    const safe = column(records, 'safe');
    const arrived = column(records, 'arrived');
    // With the built in reward a red light ends the trip, so every arrival is safe and one line says it all.
    const differ = arrived.some((v, i) => v !== safe[i]);
    return [
      ...(differ ? [{ label: 'Arrived', color: COLORS.arrived, values: arrived }] : []),
      { label: 'Arrived safely', color: COLORS.safe, values: safe, fill: true },
      { label: 'Best fifth, safely', color: COLORS.elite, values: column(records, 'eliteSafe'), dash: [4, 3], width: 1.5 },
    ];
  }, [records]);
  const safety = useMemo<Series[]>(
    () => [
      { label: 'Crashed', color: COLORS.crash, values: column(records, 'crashes') },
      { label: 'Hit a person', color: COLORS.people, values: column(records, 'pedestrians') },
      { label: 'Left the road', color: COLORS.offRoad, values: column(records, 'offRoad') },
      { label: 'Ran a red', color: COLORS.red, values: column(records, 'redLights'), dash: [4, 3] },
    ],
    [records],
  );
  if (!records.length) return null;
  const now = (content as DrivingContent | null)?.level ?? records[records.length - 1].metrics?.level ?? 1;
  const best = Math.max(now, ...levels.map((v) => v ?? 0));
  const auto = (content as DrivingContent | null)?.curriculum;
  return (
    <>
      <Section title="Curriculum" hint={auto ? `level ${now}, ${drivingLevel(now).name}` : `fixed at level ${now}`} tour="curriculum">
        <SeriesChart x={x} series={[{ label: 'Level', color: COLORS.level, values: levels, stepped: true, fill: true, width: 2 }]} yLabel="Level" format={String} range={[0.5, 5.5]} ticks={LEVEL_TICKS} height={140} />
        <LevelSteps now={now} best={best} />
      </Section>
      <Section title="Arrivals" hint={`share of trips, mean of ${SMOOTH} generations`}>
        <SeriesChart x={x} series={arrivals} yLabel="Trips" format={share} range={[0, 1]} marks={marks} bar={auto?.bar} smooth={SMOOTH} />
        {auto && <p className="text-[11px] text-subtle">The level moves up once the best fifth arrives safely on {share(auto.bar)} of its trips, over a few generations.</p>}
      </Section>
      <Section title="Safety" hint={`how trips ended, mean of ${SMOOTH} generations`}>
        <SeriesChart x={x} series={safety} yLabel="Trips" format={share} range={[0, 1]} marks={marks} smooth={SMOOTH} />
      </Section>
    </>
  );
}
