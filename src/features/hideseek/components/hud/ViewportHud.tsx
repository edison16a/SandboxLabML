'use client';

import { Gauge, MousePointerClick, Repeat } from 'lucide-react';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { FocusBar } from './FocusBar';
import { HiddenHistogram } from './HiddenHistogram';
import { PhotoBar } from './PhotoBar';
import { PipFrames } from './PipFrames';
import { RoundChips } from './RoundChips';
import { ViewControls } from './ViewControls';

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/75">{children}</div>;
}

/** Everything layered over the 3D viewport. Photo mode hides all of it but its own bar. */
export function ViewportHud({ viewport }: { viewport: React.RefObject<HTMLDivElement | null> }) {
  const photo = useHideSeekLab((s) => s.photoMode);
  const mode = useHideSeekLab((s) => s.mode);
  const grid = useHideSeekLab((s) => s.gridSize);
  const focus = useHideSeekLab((s) => s.focus);
  const replay = useHideSeekLab((s) => (s.mode === 'train' && s.source === 'replay' && s.speed === 'turbo' ? s.replayOf : null));
  const streaming = useHideSeekLab((s) => s.round !== null || s.replaying);
  const held = useHideSeekLab((s) => s.mode === 'train' && s.speed === 'max' && s.status === 'running');
  if (photo) return <PhotoBar viewport={viewport} />;
  const overview = mode === 'train' && grid > 1 && focus === null;
  return (
    <>
      <PipFrames />
      <div className="pointer-events-none absolute top-3 left-3 flex max-w-[52%] flex-col items-start gap-2">
        <RoundChips />
        <FocusBar />
        {replay && (
          <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/75 backdrop-blur-sm">
            <Repeat className="size-3" />
            Turbo trains headless. This is a replay of generation {replay.generation + 1}, round {replay.round + 1}.
          </span>
        )}
        {held && (
          <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-white/75 backdrop-blur-sm">
            <Gauge className="size-3" />
            Max gives every core to training, so the arenas hold still. Pick Turbo to watch replays.
          </span>
        )}
      </div>
      <div className="absolute top-3 right-3 flex max-w-[46%] flex-col items-end gap-2">
        <ViewControls />
      </div>
      {overview && streaming && (
        <div className="absolute top-[58px] left-1/2 -translate-x-1/2 @max-[60rem]:hidden">
          <HiddenHistogram />
        </div>
      )}
      <div className="absolute right-3 bottom-3 hidden md:flex">
        {overview && (
          <Hint>
            <MousePointerClick className="size-3" /> Click an arena to fly in
          </Hint>
        )}
        {/* The Sandbox card fills the bottom left, so a narrow viewport has no room for this longer hint beside it. */}
        {mode === 'sandbox' && (
          <div className="@max-[50rem]:hidden">
            <Hint>
              <MousePointerClick className="size-3" /> Drag a box or ramp to move it. Double click it to lock it for the hiders or free it.
            </Hint>
          </div>
        )}
      </div>
    </>
  );
}
