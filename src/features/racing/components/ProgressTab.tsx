'use client';

import { FitnessChart } from '@/features/charts/FitnessChart';
import { SpeciesChart } from '@/features/charts/SpeciesChart';
import { Stat } from '@/ui/primitives/Panel';
import { useRacingLab } from '../state/labStore';

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
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

/** Fitness curve, species bands and the latest champions. */
export function ProgressTab() {
  const records = useRacingLab((s) => s.records);
  const last = records[records.length - 1];
  const recent = records.slice(-8).reverse();
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Best fitness" value={last ? last.stats.best.toFixed(1) : '0'} />
        <Stat label="Species" value={last ? last.stats.species.length : 0} />
        <Stat label="Avg links" value={last ? last.stats.meanConnections.toFixed(1) : '0'} hint="Mean enabled connections per brain" />
      </div>
      <Section title="Fitness" hint="best, median, mean">
        {records.length > 0 ? <FitnessChart records={records} /> : <Empty />}
      </Section>
      <Section title="Species" hint="share of the population">
        {records.length > 0 ? <SpeciesChart records={records} /> : <Empty />}
      </Section>
      <Section title="Recent champions">
        <table className="w-full text-[12px]">
          <thead className="text-left text-subtle">
            <tr>
              <th className="py-1 font-medium">Gen</th>
              <th className="py-1 font-medium">Fitness</th>
              <th className="py-1 font-medium">Distance</th>
              <th className="py-1 font-medium">Best lap</th>
              <th className="py-1 font-medium">Ended</th>
            </tr>
          </thead>
          <tbody className="tabular font-mono">
            {recent.map((r) => (
              <tr key={r.generation} className="border-t border-border">
                <td className="py-1.5">{r.generation + 1}</td>
                <td className="py-1.5">{r.champion.fitness.toFixed(1)}</td>
                <td className="py-1.5">{Math.round(r.champion.distance)} m</td>
                <td className="py-1.5">{r.champion.bestLapTime > 0 ? `${r.champion.bestLapTime.toFixed(2)} s` : '-'}</td>
                <td className="py-1.5 font-sans text-muted">{r.champion.stopReason ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!recent.length && <Empty />}
      </Section>
    </div>
  );
}

function Empty() {
  return <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-subtle">Press Train to start the first generation.</div>;
}
