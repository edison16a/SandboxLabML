'use client';

import { useState } from 'react';
import { Sprout } from 'lucide-react';
import type { Blueprint } from '@/engine/blueprints/types';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { forkLabRun } from '@/features/runs/labRuns';
import { setSetting } from '@/storage/settings';
import { Button } from '@/ui/primitives/Button';
import { toast } from '@/ui/toast/toastStore';
import { useRunSchema } from '../hooks/useRunSchema';
import { useLab, useLabContext } from '../LabContext';

/**
 * "Grow this brain": a new run from the latest checkpoint with more
 * sensors, keeping what the brain learned. It edits the run's blueprint
 * with the env's own sensor form (see BLUEPRINT_FORMS) and matches inputs
 * by their schema keys, so it works the same in every lab.
 */
export function GrowBrain() {
  const { env, session, lastRunKey } = useLabContext();
  const run = useLab((s) => s.run);
  const schema = useRunSchema();
  const [growing, setGrowing] = useState(false);
  if (!run) return null;
  const own = run.blueprint.env === env;

  const grow = async (blueprint: Blueprint) => {
    try {
      await session.pause();
      const custom = schema.filter((s) => s.group === 'custom').map((s) => ({ key: s.key.replace('custom:', ''), label: s.label, unit: s.unit, min: s.offset, max: s.offset + s.scale }));
      const config = await forkLabRun(run, blueprint, custom);
      await session.openRun(config.id);
      await setSetting(lastRunKey, config.id);
      toast.success('Brain grown');
    } catch (err) {
      toast.error('Could not grow the brain', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-[12px] text-muted">Add sensors, keep what it learned.</p>
        <Button size="sm" variant="outline" onClick={() => setGrowing(true)} disabled={!own}>
          <Sprout />
          Grow this brain
        </Button>
      </div>
      {own && (
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
