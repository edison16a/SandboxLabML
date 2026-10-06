'use client';

import { ArrowLeft, Crosshair } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { glass } from './ViewControls';

/** Shows which arena is in the showcase, with a way back to the grid. */
export function FocusBar() {
  const focus = useHideSeekLab((s) => s.focus);
  const grid = useHideSeekLab((s) => s.gridSize);
  const mode = useHideSeekLab((s) => s.mode);
  const agent = useHideSeekLab((s) => s.inspectAgent);
  const set = useHideSeekLab((s) => s.set);
  if (mode !== 'train' || focus === null) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-1.5">
      {grid > 1 && (
        <Button size="sm" variant="secondary" className={glass} onClick={() => set({ focus: null })}>
          <ArrowLeft />
          All arenas
          <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px] text-white/70">Esc</kbd>
        </Button>
      )}
      <span className="flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-black/50 px-2.5 text-[12px] text-white backdrop-blur-sm">
        <Crosshair className="size-3.5 text-white/60" />
        Arena {focus + 1}
        <span className="text-white/50">inspecting the {agent === 0 ? 'hider' : 'seeker'}</span>
      </span>
    </div>
  );
}
