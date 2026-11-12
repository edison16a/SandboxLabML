'use client';

import { metricValue } from '@/engine/env/metrics';
import { FitnessChart } from '@/features/charts/FitnessChart';
import { SpeciesChart } from '@/features/charts/SpeciesChart';
import { BenchmarkChart } from '@/features/charts/BenchmarkChart';
import { Stat } from '@/ui/primitives/Panel';
import { useLab, useLabContext } from '../LabContext';
import { MetricsSection } from './MetricsSection';
import { Section } from './Section';

/**
 * Fitness curve, the env's metrics, the benchmark, species bands and the
 * latest champions. The champion table shows the env's champion metrics
 * (Driving: arrived, distance and red lights) between fitness and how the
 * run ended.
 * `extra` is a lab's own panels, placed under the metrics. `metrics`
 * replaces the generic metrics charts, for a lab that charts its numbers
 * its own way (Navigation: the level timeline and the finish shares).
 */
export function ProgressTab({ extra, metrics }: { extra?: React.ReactNode; metrics?: React.ReactNode }) {
  const { env, module } = useLabContext();
  const records = useLab((s) => s.records);
  const last = records[records.length - 1];
  const recent = records.slice(-8).reverse();
  const columns = module.metrics.filter((m) => m.source === 'champion');
  if (!last) {
    // The walkthrough's fitness step frames this placeholder until the chart exists.
    return (
      <div className="p-4" data-tour="fitness">
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
      <Section title="Fitness" hint="best, median, mean" tour="fitness">
        <FitnessChart records={records} />
      </Section>
      {metrics ?? <MetricsSection records={records} />}
      {extra}
      {module.bench && (
        <Section title="Benchmark" hint={module.bench.hint}>
          <BenchmarkChart env={env} records={records} />
        </Section>
      )}
      <Section title="Species" hint="share of the population" tour="species">
        <SpeciesChart records={records} />
      </Section>
      <Section title="Recent champions">
        <table className="w-full text-[12px]">
          <thead className="text-left text-subtle">
            <tr>
              <th className="py-1 font-medium">Gen</th>
              <th className="py-1 font-medium">Fitness</th>
              {columns.map((m) => (
                <th key={m.key} className="py-1 font-medium">
                  {m.label}
                </th>
              ))}
              <th className="py-1 font-medium">Ended</th>
            </tr>
          </thead>
          <tbody className="tabular font-mono">
            {recent.map((r) => (
              <tr key={r.generation} className="border-t border-border">
                <td className="py-1.5">{r.generation + 1}</td>
                <td className="py-1.5">{r.champion.fitness.toFixed(1)}</td>
                {columns.map((m) => (
                  <td key={m.key} className="py-1.5">
                    {m.format(metricValue(r, m))}
                  </td>
                ))}
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
  const running = useLab((s) => s.status === 'running');
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-subtle">
      {running ? 'First generation running' : 'Press Train to start'}
    </div>
  );
}
