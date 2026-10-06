'use client';

import { useMemo } from 'react';
import { Stat } from '@/ui/primitives/Panel';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { HsLineChart, Legend } from './charts/HsLineChart';
import { SpeciesBands } from './charts/SpeciesBands';

const HIDER = '#4c9aff';
const SEEKER = '#ff5f6d';
const AMBER = '#ffb547';
const MUTED = '#8a94a7';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-subtle">Press Train to play the first generation.</div>;
}

/** Both teams' fitness, how long hiders stay hidden, how much the boxes get used, and species. */
export function ProgressTab() {
  const records = useHideSeekLab((s) => s.records);
  const last = records[records.length - 1];
  const charts = useMemo(() => {
    const gens = records.map((r) => r.generation + 1);
    const pct = (v: number) => Math.round(v * 1000) / 10;
    return {
      gens,
      fitness: [
        { label: 'Hider best', color: HIDER, values: records.map((r) => r.stats.hiders.best), width: 2 },
        { label: 'Seeker best', color: SEEKER, values: records.map((r) => r.stats.seekers.best), width: 2 },
        { label: 'Hider mean', color: HIDER, values: records.map((r) => r.stats.hiders.mean), dash: [4, 4], width: 1 },
        { label: 'Seeker mean', color: SEEKER, values: records.map((r) => r.stats.seekers.mean), dash: [4, 4], width: 1 },
      ],
      hidden: [
        { label: 'Current teams', color: HIDER, values: records.map((r) => pct(r.stats.game.currentHiddenShare)), width: 2, fill: true },
        { label: 'All matches', color: MUTED, values: records.map((r) => pct(r.stats.game.hiddenShare)), dash: [4, 4], width: 1 },
      ],
      boxes: [
        { label: 'Locks', color: AMBER, values: records.map((r) => r.stats.game.locksPerMatch), width: 2 },
        { label: 'Boxes moved', color: MUTED, values: records.map((r) => r.stats.game.boxesMovedPerMatch), width: 1.5 },
      ],
    };
  }, [records]);
  if (!records.length) {
    return (
      <div className="p-4">
        <Empty />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Hidden" value={`${Math.round(last.stats.game.currentHiddenShare * 100)}%`} hint="Share of seek time hiders stayed out of sight, current teams" />
        <Stat label="Locks a match" value={last.stats.game.locksPerMatch.toFixed(2)} />
        <Stat label="Species" value={`${last.stats.hiders.species.length} / ${last.stats.seekers.species.length}`} hint="Hider species / seeker species" />
      </div>
      <Section title="Fitness" hint="per team">
        <HsLineChart generations={charts.gens} series={charts.fitness} yLabel="Fitness" />
        <Legend items={charts.fitness.map((s) => ({ label: s.label, color: s.color, dashed: !!s.dash }))} />
      </Section>
      <Section title="Hidden share" hint="% of seek time">
        <HsLineChart generations={charts.gens} series={charts.hidden} yLabel="%" range={[0, 100]} height={130} />
        <Legend items={[{ label: 'Current teams', color: HIDER }, { label: 'Including hall of fame', color: MUTED, dashed: true }]} />
      </Section>
      <Section title="Box use" hint="per match">
        <HsLineChart generations={charts.gens} series={charts.boxes} yLabel="Count" height={120} />
        <Legend items={charts.boxes.map((s) => ({ label: s.label, color: s.color }))} />
      </Section>
      <Section title="Species" hint="share of each team">
        <SpeciesBands stats={records.map((r) => r.stats.hiders)} hue={214} label="Hider species per generation" />
        <SpeciesBands stats={records.map((r) => r.stats.seekers)} hue={354} label="Seeker species per generation" />
      </Section>
    </div>
  );
}
