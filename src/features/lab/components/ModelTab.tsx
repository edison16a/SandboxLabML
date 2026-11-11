'use client';

import { useMemo } from 'react';
import { blueprintShape } from '@/engine/blueprints/shape';
import { startingLinks } from '@/engine/neat/startShape';
import { ModelDownloads } from '@/features/modelcard/ModelDownloads';
import { ModelCard } from '@/features/modelcard/ModelCard';
import { useRunSchema } from '../hooks/useRunSchema';
import { useLab, useLabContext } from '../LabContext';

/**
 * Model card for the latest champion of the open run, with its downloads.
 * `header` sits above them, for lab actions on the brain such as Racing's
 * "grow this brain".
 */
export function ModelTab({ header }: { header?: React.ReactNode }) {
  const { module } = useLabContext();
  const run = useLab((s) => s.run);
  const records = useLab((s) => s.records);
  const schema = useRunSchema();
  const latest = records[records.length - 1];
  const reference = useMemo(() => {
    if (!run) return 0;
    const shape = blueprintShape(run.blueprint, run.customSensors);
    // Sparse wiring is measured against the full direct wiring, the brain it can grow into.
    return startingLinks(shape.wiring === 'sparse' ? { ...shape, wiring: 'direct' } : shape);
  }, [run]);
  if (!run || !latest) return <div className="p-4 text-[13px] text-muted">Appears after the first generation.</div>;

  return (
    <div className="flex flex-col">
      {header}
      <ModelDownloads
        source={{
          run,
          genome: latest.genome,
          generation: latest.generation,
          fitness: latest.champion.fitness,
          inputLabels: schema.map((s) => s.label),
          outputLabels: module.outputs.map((o) => o.label),
        }}
      />
      <ModelCard runId={run.id} genome={latest.genome} records={records} reference={reference} blueprintName={run.blueprint.name} />
    </div>
  );
}
