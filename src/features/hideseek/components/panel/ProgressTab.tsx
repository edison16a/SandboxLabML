'use client';

import { useMemo } from 'react';
import { BenchmarkChart } from '@/features/charts/BenchmarkChart';
import { Stat } from '@/ui/primitives/Panel';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { HsLineChart, Legend } from './charts/HsLineChart';
import { boxAndRampSeries, legendOf, PROGRESS_COLORS } from './charts/progressSeries';
import { SpeciesBands } from './charts/SpeciesBands';

const { hider: HIDER, seeker: SEEKER, amber: AMBER, muted: MUTED } = PROGRESS_COLORS;

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
  const running = useHideSeekLab((s) => s.status === 'running');
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border px-6 text-center text-[12px] text-subtle">
      {running ? 'First generation running' : 'Press Train to start'}
    </div>
  );
}

/** The locks stat's tooltip: who placed them, once the history says. */
function lockSplit(g: { hiderLocksPerMatch?: number; seekerLocksPerMatch?: number }): string {
  if (g.hiderLocksPerMatch === undefined || g.seekerLocksPerMatch === undefined) return 'Boxes locked per match, latest generation';
  return `Hiders ${g.hiderLocksPerMatch.toFixed(2)}, seekers ${g.seekerLocksPerMatch.toFixed(2)} per match`;
}

/** Both teams' fitness, the benchmark, how long hiders stay hidden, how much the boxes and ramps get used, and species. */
export function ProgressTab() {
  const records = useHideSeekLab((s) => s.records);
  const last = records[records.length - 1];
  const charts = useMemo(() => {
    const gens = records.map((r) => r.generation + 1);
    const pct = (v: number) => Math.round(v * 1000) / 10;
    const opt = (v: number | undefined) => (v === undefined ? null : pct(v));
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
        { label: 'In the open', color: AMBER, values: records.map((r) => opt(r.stats.game.exposedShare)), dash: [2, 3], width: 1.25 },
      ],
      // Scores against the fixed, scripted sparring partners. They are the same yardstick every
      // generation, so unlike the co-evolution numbers above they rise as each team gets better.
      skill: [
        { label: 'Hiders vs scripted seeker', color: HIDER, values: records.map((r) => opt(r.stats.game.scriptedHiddenShare)), width: 2 },
        { label: 'Seekers vs scripted hider', color: SEEKER, values: records.map((r) => opt(r.stats.game.scriptedSeenShare)), width: 2 },
      ],
      ...boxAndRampSeries(records),
    };
  }, [records]);
  const hasExposed = records.some((r) => r.stats.game.exposedShare !== undefined);
  const hasSkill = records.some((r) => r.stats.game.scriptedHiddenShare !== undefined || r.stats.game.scriptedSeenShare !== undefined);
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
        <Stat label="Hidden" value={`${Math.round(last.stats.game.currentHiddenShare * 100)}%`} hint="Share of seek time the hiders stayed out of sight" />
        <Stat label="Locks a match" value={last.stats.game.locksPerMatch.toFixed(2)} hint={lockSplit(last.stats.game)} />
        <Stat label="Species" value={`${last.stats.hiders.species.length} / ${last.stats.seekers.species.length}`} hint="Groups of similar brains, hiders / seekers" />
      </div>
      <Section title="Fitness" hint="per team">
        <HsLineChart generations={charts.gens} series={charts.fitness} yLabel="Fitness" />
        <Legend items={charts.fitness.map((s) => ({ label: s.label, color: s.color, dashed: !!s.dash }))} />
      </Section>
      <Section title="Benchmark" hint="vs reference champions, 0 to 100">
        <BenchmarkChart env="hideseek" records={records} height={140} />
      </Section>
      <Section title="Hidden share" hint="% of seek time">
        <HsLineChart generations={charts.gens} series={charts.hidden} yLabel="%" range={[0, 100]} height={130} />
        <Legend items={[{ label: 'Current teams', color: HIDER }, { label: 'Including hall of fame', color: MUTED, dashed: true }, ...(hasExposed ? [{ label: 'In the open', color: AMBER, dashed: true }] : [])]} />
      </Section>
      {hasSkill && (
        <Section title="Skill check" hint="% vs scripted partners">
          <HsLineChart generations={charts.gens} series={charts.skill} yLabel="%" range={[0, 100]} height={120} />
          <Legend items={[{ label: 'Hiders hidden from a scripted seeker', color: HIDER }, { label: 'Seekers seeing a scripted hider', color: SEEKER }]} />
        </Section>
      )}
      <Section title="Box use" hint="per match">
        <HsLineChart generations={charts.gens} series={charts.boxes} yLabel="Count" height={120} />
        <Legend items={legendOf(charts.boxes)} />
      </Section>
      {charts.ramps && (
        <Section title="Ramps" hint="per match">
          <HsLineChart generations={charts.gens} series={charts.ramps} yLabel="Count" height={110} />
          <Legend items={legendOf(charts.ramps)} />
        </Section>
      )}
      <Section title="Species" hint="share of each team">
        <SpeciesBands stats={records.map((r) => r.stats.hiders)} hue={214} label="Hider species per generation" />
        <SpeciesBands stats={records.map((r) => r.stats.seekers)} hue={354} label="Seeker species per generation" />
      </Section>
    </div>
  );
}
