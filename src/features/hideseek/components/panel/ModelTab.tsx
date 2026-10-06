'use client';

import { useMemo } from 'react';
import { blueprintShape } from '@/engine/blueprints/shape';
import type { HideSeekRecord } from '@/engine/training/hideseekRecords';
import { hideSeekBlueprints } from '@/engine/training/hideseekRunConfig';
import type { GenerationRecord } from '@/engine/training/records';
import { ModelCard } from '@/features/modelcard/ModelCard';
import { useHideSeekLab } from '../../state/hideSeekStore';
import type { Team } from '../../state/types';
import { TeamToggle } from './TeamToggle';

/**
 * The model card is shared with Racing and reads Racing shaped records, so
 * each Hide and Seek generation is presented as one: the team's champion
 * genome, its best fitness and the generation's simulated time. Fields only
 * a car has stay empty.
 */
function cardRecords(records: HideSeekRecord[], team: Team): GenerationRecord[] {
  return records.map((r) => {
    const stats = team === 'hider' ? r.stats.hiders : r.stats.seekers;
    const genome = team === 'hider' ? r.hiderChampion : r.seekerChampion;
    return {
      runId: r.runId,
      generation: r.generation,
      stats,
      champion: { genomeId: genome.id, fitness: stats.best, distance: 0, laps: 0, bestLapTime: 0, crashed: false, crashX: 0, crashY: 0, stopReason: null },
      genome,
      trackHash: '',
      replaySeed: 0,
      simSeconds: r.simSeconds,
      wallMs: r.wallMs,
    };
  });
}

/** The model card of either team's latest champion. */
export function ModelTab() {
  const run = useHideSeekLab((s) => s.run);
  const records = useHideSeekLab((s) => s.records);
  const team = useHideSeekLab((s) => s.modelTeam);
  const set = useHideSeekLab((s) => s.set);
  const cards = useMemo(() => cardRecords(records, team), [records, team]);
  const blueprint = run?.env === 'hideseek' ? hideSeekBlueprints(run)[team] : null;
  const reference = useMemo(() => {
    if (!blueprint) return 0;
    const shape = blueprintShape(blueprint, 0);
    // Direct wiring links every input and the bias to every output.
    return shape.wiring === 'hidden'
      ? (shape.inputCount + 1) * (shape.hiddenCount ?? 4) + ((shape.hiddenCount ?? 4) + 1) * shape.outputCount
      : (shape.inputCount + 1) * shape.outputCount;
  }, [blueprint]);
  const latest = cards[cards.length - 1];
  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4">
        <TeamToggle value={team === 'hider' ? 0 : 1} onChange={(v) => set({ modelTeam: v === 0 ? 'hider' : 'seeker' })} />
      </div>
      {!run || !latest || !blueprint ? (
        <div className="p-4 text-[13px] text-muted">The model card fills in after the first generation.</div>
      ) : (
        <ModelCard runId={run.id} genome={latest.genome} records={cards} reference={reference} blueprintName={blueprint.name} />
      )}
    </div>
  );
}
