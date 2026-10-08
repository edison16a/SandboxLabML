'use client';

import { FitnessChart } from '@/features/charts/FitnessChart';
import { SpeciesChart } from '@/features/charts/SpeciesChart';
import { BenchmarkChart } from '@/features/charts/BenchmarkChart';
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
  if (!last) {
    return (
      <div className="p-4">
        <Empty />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Best fitness" value={last.stats.best.toFixed(1)} hint="The top score from the training rewards" />
        <Stat label="Species" value={last.stats.species.length} hint="Groups of similar brains that breed among themselves" />
        <Stat label="Avg links" value={last.stats.meanConnections.toFixed(1)} hint="Average number of working connections in a brain" />
      </div>
      <Section title="Fitness" hint="best, median, mean">
        <FitnessChart records={records} />
      </Section>
      <Section title="Benchmark" hint="unseen tracks, 0 to 100">
        <BenchmarkChart records={records} />
      </Section>
      <Section title="Species" hint="share of the population">
        <SpeciesChart records={records} />
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
      </Section>
    </div>
  );
}

/** The one placeholder the tab shows until the first generation is done. */
function Empty() {
  const running = useRacingLab((s) => s.status === 'running');
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-subtle">
      {running ? 'First generation running' : 'Press Train to start'}
    </div>
  );
}
