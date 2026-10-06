'use client';

import { useEffect, useState } from 'react';
import { formatBytes, modelMetrics } from '@/engine/neat/metrics';
import type { Genome } from '@/engine/neat/types';
import type { GenerationRecord } from '@/engine/training/records';
import { runStorage, type StorageBreakdown } from '@/storage/meter';
import { GrowthChart } from './GrowthChart';

interface Props {
  runId: string;
  genome: Genome;
  records: GenerationRecord[];
  /** Parameter count of the blueprint's starting brain. */
  reference: number;
  blueprintName: string;
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-0" title={hint}>
      <span className="text-muted">{label}</span>
      <span className="tabular text-right font-mono text-fg">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The model card: what the champion brain is made of, what it costs to run,
 * how much space the run takes and how it got here.
 */
export function ModelCard({ runId, genome, records, reference, blueprintName }: Props) {
  const m = modelMetrics(genome);
  const [disk, setDisk] = useState<StorageBreakdown | null>(null);
  const generations = records.length;
  useEffect(() => {
    let alive = true;
    void runStorage(runId).then((d) => alive && setDisk(d));
    return () => {
      alive = false;
    };
  }, [runId, generations]);
  const simSeconds = records.reduce((s, r) => s + r.simSeconds, 0);
  const best = records.reduce((b, r) => Math.max(b, r.champion.fitness), 0);
  const bench = [...records].reverse().find((r) => r.benchmark !== undefined)?.benchmark;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Parameters', m.parameters.toLocaleString('en-US')],
          ['Neurons', m.neurons.total],
          ['Size', formatBytes(m.bytes)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-surface-2 px-3 py-2">
            <div className="text-[11px] text-muted">{label}</div>
            <div className="tabular font-mono text-[18px] font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <Section title="Neurons">
        <Row label="Inputs" value={m.neurons.input} />
        <Row label="Bias" value={m.neurons.bias} />
        <Row label="Hidden" value={m.neurons.hidden} />
        <Row label="Outputs" value={m.neurons.output} />
      </Section>
      <Section title="Connections">
        <Row label="Enabled" value={m.connections.enabled} />
        <Row label="Disabled" value={m.connections.disabled} hint="Disabled genes stay in the genome and can switch back on." />
        <Row label="Cost per decision" value={`${m.costPerDecision} multiply-adds`} />
      </Section>
      <Section title="Training">
        <Row label="Blueprint" value={blueprintName} />
        <Row label="Generations" value={generations} />
        <Row label="Simulated time" value={`${(simSeconds / 3600).toFixed(2)} h`} />
        <Row label="Best fitness" value={best.toFixed(1)} />
        <Row label="Benchmark" value={bench !== undefined ? `${bench.toFixed(0)} / 100` : 'not run yet'} />
      </Section>
      <Section title="Growth">
        <GrowthChart records={records} reference={reference} />
      </Section>
      <Section title="On disk">
        <Row label="Champions" value={disk ? formatBytes(disk.champions) : '...'} />
        <Row label="Checkpoints" value={disk ? formatBytes(disk.checkpoints) : '...'} />
        <Row label="Caches" value={disk ? formatBytes(disk.caches) : '...'} />
        <Row label="Total" value={disk ? formatBytes(disk.total) : '...'} />
      </Section>
    </div>
  );
}
