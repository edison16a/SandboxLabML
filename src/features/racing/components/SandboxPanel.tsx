'use client';

import { useMemo, useState } from 'react';
import { Dices, Flag, PencilRuler, RotateCcw, X } from 'lucide-react';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { randomTrackSpec } from '@/engine/racing/track/randomTrack';
import { checkTrack } from '@/engine/racing/track/validate';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { NewRunDialog } from './NewRunDialog';

/**
 * Sandbox controls over the viewport: edit the track, try a random one, and
 * start a new run on what you drew. Champions replay on every change, which
 * answers "what would generation 5 do on this new corner?".
 */
export function SandboxPanel() {
  const mode = useRacingLab((s) => s.mode);
  const spec = useRacingLab((s) => s.sandboxTrack);
  const editing = useRacingLab((s) => s.editingTrack);
  const run = useRacingLab((s) => s.run);
  const set = useRacingLab((s) => s.set);
  const [train, setTrain] = useState(false);
  const problems = useMemo(() => (spec ? checkTrack(buildTrack(spec)) : null), [spec]);
  if (mode !== 'sandbox' || !spec) return null;
  const session = racingSession();
  const update = (patch: Partial<typeof spec>) => {
    set({ sandboxTrack: { ...spec, ...patch, id: spec.id.startsWith('custom') ? spec.id : `custom-${Date.now().toString(36)}`, name: 'Custom track' } });
    session.sandboxChanged();
  };
  const ok = problems && !problems.tooTight && !problems.selfIntersects;

  return (
    <div className="absolute bottom-3 left-1/2 flex w-[min(640px,calc(100%-24px))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-white/10 bg-black/65 p-3 text-white backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="orange">Sandbox</Badge>
        <span className="text-[12px] text-white/70">Champions replay on this track. Training is paused.</span>
        <Button size="sm" variant="ghost" className="ml-auto text-white/80 hover:bg-white/10 hover:text-white" onClick={() => void session.exitSandbox()}>
          <X />
          Back to training
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => set({ editingTrack: !editing, selectedHandle: null })}>
          <PencilRuler />
          {editing ? 'Done editing' : 'Edit track'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => update({ ...randomTrackSpec(Math.floor(Math.random() * 1e6), spec.width) })}>
          <Dices />
          Random track
        </Button>
        <Button size="sm" variant="secondary" onClick={() => run?.racing && (set({ sandboxTrack: structuredClone(run.racing.track) }), session.sandboxChanged())}>
          <RotateCcw />
          Run track
        </Button>
        <div className="flex min-w-40 flex-1 items-center gap-2 text-[12px] text-white/70">
          Width {spec.width} m
          <Slider label="Track width" min={7} max={14} value={spec.width} onChange={(w) => update({ width: w })} />
        </div>
        <Button size="sm" variant="primary" disabled={!ok} onClick={() => setTrain(true)}>
          <Flag />
          Train here
        </Button>
      </div>
      {editing && <p className="text-[11px] text-white/60">Drag a point to move it. Double click the ground to add one. Select a point and press Delete to remove it.</p>}
      {problems && !ok && (
        <p className="text-[12px] text-warn">
          {problems.selfIntersects ? 'The road crosses itself. ' : ''}
          {problems.tooTight ? `The tightest corner is ${problems.minRadius.toFixed(1)} m, below the 12 m the car can take. ` : ''}
          Ghosts still run, but this track cannot start a new run.
        </p>
      )}
      <NewRunDialog open={train} onOpenChange={setTrain} initialTrack={spec} />
    </div>
  );
}
