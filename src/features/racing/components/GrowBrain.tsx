'use client';

import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { useRunSchema } from '@/features/lab/hooks/useRunSchema';
import { forkRacingRun } from '@/storage/forkRun';
import { setSetting } from '@/storage/settings';
import { Button } from '@/ui/primitives/Button';
import { toast } from '@/ui/toast/toastStore';
import { LAST_RUN_KEY } from '../hooks/useRunBootstrap';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';

/** "Grow this brain": a new run from the latest checkpoint with more sensors, keeping what the brain learned. */
export function GrowBrain() {
  const run = useRacingLab((s) => s.run);
  const schema = useRunSchema();
  const [growing, setGrowing] = useState(false);
  if (!run) return null;

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
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-[12px] text-muted">Add sensors, keep what it learned.</p>
        <Button size="sm" variant="outline" onClick={() => setGrowing(true)} disabled={run.blueprint.env !== 'racing'}>
          <Sprout />
          Grow this brain
        </Button>
      </div>
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
    </>
  );
}
