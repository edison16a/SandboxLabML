'use client';

import { useMemo, useState } from 'react';
import { Sprout } from 'lucide-react';
import { blueprintShape } from '@/engine/blueprints/shape';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { ModelCard } from '@/features/modelcard/ModelCard';
import { forkRacingRun } from '@/storage/forkRun';
import { setSetting } from '@/storage/settings';
import { Button } from '@/ui/primitives/Button';
import { toast } from '@/ui/toast/toastStore';
import { LAST_RUN_KEY } from '../hooks/useRunBootstrap';
import { useRunSchema } from '../hooks/useRunSchema';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';

/** Model card for the latest champion of the open run, plus "grow this brain". */
export function ModelTab() {
  const run = useRacingLab((s) => s.run);
  const records = useRacingLab((s) => s.records);
  const schema = useRunSchema();
  const [growing, setGrowing] = useState(false);
  const latest = records[records.length - 1];
  const reference = useMemo(() => {
    if (!run) return 0;
    const shape = blueprintShape(run.blueprint, run.customSensors);
    // Direct wiring links every input and the bias to every output.
    return shape.wiring === 'hidden'
      ? (shape.inputCount + 1) * (shape.hiddenCount ?? 4) + ((shape.hiddenCount ?? 4) + 1) * shape.outputCount
      : (shape.inputCount + 1) * shape.outputCount;
  }, [run]);
  if (!run || !latest) return <div className="p-4 text-[13px] text-muted">Appears after the first generation.</div>;

  const grow = async (blueprint: Parameters<typeof forkRacingRun>[1]) => {
    const session = racingSession();
    try {
      await session.pause();
      const custom = schema.filter((s) => s.group === 'custom').map((s) => ({ key: s.key.replace('custom:', ''), label: s.label, unit: s.unit, min: s.offset, max: s.offset + s.scale }));
      const config = await forkRacingRun(run.id, blueprint, custom);
      await session.openRun(config.id);
      await setSetting(LAST_RUN_KEY, config.id);
      toast.success('Brain grown');
    } catch (err) {
      toast.error('Could not grow the brain', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-[12px] text-muted">Change the sensors, keep what it learned.</p>
        <Button size="sm" variant="outline" onClick={() => setGrowing(true)} disabled={run.blueprint.env !== 'racing'}>
          <Sprout />
          Grow this brain
        </Button>
      </div>
      <ModelCard runId={run.id} genome={latest.genome} records={records} reference={reference} blueprintName={run.blueprint.name} />
      {run.blueprint.env === 'racing' && (
        <BlueprintDialog
          open={growing}
          onOpenChange={setGrowing}
          base={run.blueprint}
          title="Grow this brain"
          description="Starts a new run from the latest checkpoint. New inputs start unconnected."
          action="Create grown run"
          onSave={(b) => grow(b)}
        />
      )}
    </div>
  );
}
