'use client';

import { useState } from 'react';
import { bestMetric, chartedMetrics, metricValue } from '@/engine/env/metrics';
import type { GenerationRecord } from '@/engine/training/records';
import { MetricChart } from '@/features/charts/MetricChart';
import { Segmented } from '@/ui/primitives/Segmented';
import { useLabContext } from '../LabContext';
import { Section } from './Section';

/**
 * The env's own numbers per generation, one chart at a time with a picker
 * when there are several: a curriculum level, the share that arrived, an
 * average speed. It reads the module's metrics, so a new env shows here
 * without touching this file. An env that charts none shows nothing.
 */
export function MetricsSection({ records }: { records: GenerationRecord[] }) {
  const { module } = useLabContext();
  const specs = chartedMetrics(module.metrics);
  const [picked, setPicked] = useState<string | null>(null);
  const spec = specs.find((m) => m.key === picked) ?? specs[0];
  if (!spec) return null;
  const show = (v: number) => (Number.isFinite(v) ? spec.format(v) : '-');
  const latest = metricValue(records[records.length - 1], spec);
  return (
    <Section title="Metrics" hint={`now ${show(latest)}, best ${show(bestMetric(records, spec))}`}>
      {specs.length > 1 && (
        <Segmented size="sm" label="Metric" value={spec.key} options={specs.map((m) => ({ value: m.key, label: m.label }))} onChange={setPicked} className="self-start" />
      )}
      <MetricChart records={records} spec={spec} />
    </Section>
  );
}
