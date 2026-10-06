'use client';

import { useMemo } from 'react';
import { blueprintShape } from '@/engine/blueprints/shape';
import { ModelCard } from '@/features/modelcard/ModelCard';
import { useRacingLab } from '../state/labStore';

/** Model card for the latest champion of the open run. */
export function ModelTab() {
  const run = useRacingLab((s) => s.run);
  const records = useRacingLab((s) => s.records);
  const latest = records[records.length - 1];
  const reference = useMemo(() => {
    if (!run) return 0;
    const shape = blueprintShape(run.blueprint, run.customSensors);
    // Direct wiring links every input and the bias to every output.
    return shape.wiring === 'hidden'
      ? (shape.inputCount + 1) * (shape.hiddenCount ?? 4) + ((shape.hiddenCount ?? 4) + 1) * shape.outputCount
      : (shape.inputCount + 1) * shape.outputCount;
  }, [run]);
  if (!run || !latest) return <div className="p-4 text-[13px] text-muted">The model card fills in after the first generation.</div>;
  return <ModelCard runId={run.id} genome={latest.genome} records={records} reference={reference} blueprintName={run.blueprint.name} />;
}
