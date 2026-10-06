'use client';

import { useMemo, useState } from 'react';
import { Check, Flag, PencilRuler } from 'lucide-react';
import { checkTrack } from '@/engine/racing/track/validate';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { racingSession } from '../../session/RacingSession';
import { forTraining, sameRoad, trackFor } from '../../session/trackChoice';
import { useRacingLab } from '../../state/labStore';
import { NewRunDialog } from '../NewRunDialog';
import { overlayButton } from './overlay';
import { SaveTrackButton } from './SaveTrackButton';

/**
 * The current track's name and length, its width, and what to do with it:
 * edit the points, save it, or start a new run on it. While editing, this
 * is all the Track tab shows, so the panel stays out of the way.
 */
export function TrackTools() {
  const spec = useRacingLab((s) => s.sandboxTrack);
  const picked = useRacingLab((s) => s.sandboxPicked);
  const editing = useRacingLab((s) => s.editingTrack);
  const set = useRacingLab((s) => s.set);
  const [train, setTrain] = useState(false);
  const info = useMemo(() => {
    if (!spec) return null;
    const track = trackFor(spec);
    return { length: track.length, problems: checkTrack(track) };
  }, [spec]);
  // Memoized so the dialog's prefill does not reset on every render while it is open.
  const trainSpec = useMemo(() => (spec ? forTraining(spec, picked) : null), [spec, picked]);
  if (!spec || !info || !trainSpec) return null;

  const edited = !picked || !sameRoad(spec, picked);
  const { problems } = info;
  const ok = !problems.tooTight && !problems.selfIntersects;
  const setWidth = (width: number) => {
    set({ sandboxTrack: { ...spec, width } });
    racingSession().sandboxChanged();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="truncate font-medium text-white">{edited ? `${picked?.name ?? 'Track'}, edited` : spec.name}</span>
        <span className="tabular shrink-0 font-mono text-white/55">{Math.round(info.length)} m</span>
      </div>
      {editing && <p className="text-[11px] leading-snug text-white/60">Drag a point to move it. Double click the ground to add one. Select a point and press Delete to remove it.</p>}
      <div className="flex items-center gap-3 text-[12px] text-white/70">
        <span className="shrink-0">Width</span>
        <Slider label="Track width" min={7} max={14} value={spec.width} onChange={setWidth} />
        <span className="tabular w-10 shrink-0 text-right font-mono">{spec.width} m</span>
      </div>
      {!ok && (
        <p className="text-[12px] leading-snug text-warn">
          {problems.selfIntersects ? 'The road crosses itself. ' : ''}
          {problems.tooTight ? `The tightest corner is ${problems.minRadius.toFixed(1)} m, under the 12 m the car can take. ` : ''}
          Cars still race here, but a new run cannot train on it.
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant={editing ? 'primary' : 'secondary'} className={cn(!editing && overlayButton)} onClick={() => set({ editingTrack: !editing, selectedHandle: null })}>
          {editing ? <Check /> : <PencilRuler />}
          {editing ? 'Done' : 'Edit'}
        </Button>
        <SaveTrackButton spec={spec} picked={picked} />
        <Button size="sm" variant="secondary" className={cn(overlayButton, 'ml-auto')} disabled={!ok} onClick={() => setTrain(true)}>
          <Flag />
          Train here
        </Button>
      </div>
      <NewRunDialog open={train} onOpenChange={setTrain} initialTrack={trainSpec} />
    </div>
  );
}
