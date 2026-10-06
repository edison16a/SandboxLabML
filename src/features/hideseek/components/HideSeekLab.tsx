'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { HideSeekCanvas } from '@/render/hideseek/HideSeekCanvas';
import { useHideSeekBootstrap } from '../hooks/useHideSeekBootstrap';
import { useHideSeekInspect } from '../hooks/useHideSeekInspect';
import { useHideSeekShortcuts } from '../hooks/useHideSeekShortcuts';
import { useTeamSchemas } from '../hooks/useTeamSchema';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';
import { InputsCard } from './hud/InputsCard';
import { SandboxCard } from './hud/SandboxCard';
import { ViewportHud } from './hud/ViewportHud';
import { NewRunDialog } from './newrun/NewRunDialog';
import { HideSeekTour } from './HideSeekTour';
import { SidePanel } from './panel/SidePanel';
import { HideSeekToolbar } from './toolbar/HideSeekToolbar';

/** The Hide and Seek lab: the arena viewport and its HUD, the toolbar and the side panel. */
export function HideSeekLab() {
  const params = useSearchParams();
  const ready = useHideSeekBootstrap(params.get('run'));
  const [newRun, setNewRun] = useState(false);
  const openNewRun = useCallback(() => setNewRun(true), []);
  const pendingScript = useTrainScriptParam('hideseek', params, openNewRun);
  const viewport = useRef<HTMLDivElement>(null);
  const schemas = useTeamSchemas();
  useHideSeekShortcuts(openNewRun);
  useHideSeekInspect(ready);
  useEffect(() => {
    // ?quality=low|medium|high|ultra pins the render tier, handy on slow machines and in browser tests.
    const q = params.get('quality');
    if (q === 'low' || q === 'medium' || q === 'high' || q === 'ultra') useHideSeekLab.getState().set({ quality: q, activeTier: q });
  }, [params]);

  const session = hideSeekSession();
  const getFeed = useCallback(() => session.feed(), [session]);
  const feeds = useCallback(() => {
    const s = session.streams;
    return s ? [s.live, s.replayed] : [];
  }, [session]);
  const onMoveBox = useCallback((i: number, x: number, z: number) => session.sandbox?.moveBox(i, x, z), [session]);
  const onToggleLock = useCallback((i: number, locked: boolean) => session.sandbox?.setBoxLocked(i, locked), [session]);
  const streams = ready ? session.streams : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
        <div ref={viewport} className="relative min-h-0 flex-1 bg-bg" data-testid="hs-viewport">
          {streams ? (
            <HideSeekCanvas getFeed={getFeed} feeds={feeds} schemas={schemas} onMoveBox={onMoveBox} onToggleLock={onToggleLock} />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-muted">Starting the simulation workers...</div>
          )}
          {streams && <ViewportHud viewport={viewport} />}
          <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col items-start gap-2">
            <InputsCard />
            <SandboxCard />
          </div>
        </div>
        <HideSeekToolbar onNewRun={openNewRun} />
      </div>
      <aside className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[400px] lg:border-t-0 lg:border-l">
        <SidePanel />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      {ready && <HideSeekTour />}
    </div>
  );
}
