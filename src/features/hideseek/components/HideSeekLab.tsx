'use client';

import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HIDE_SEEK_TOUR } from '@/features/onboarding/hideSeekTour';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { HideSeekCanvas } from '@/render/hideseek/HideSeekCanvas';
import { ResizeHandle } from '@/ui/split/ResizeHandle';
import { Walkthrough } from '@/ui/walkthrough/Walkthrough';
import { useCameraPreference } from '../hooks/useCameraPreference';
import { useHideSeekBootstrap } from '../hooks/useHideSeekBootstrap';
import { useHideSeekInspect } from '../hooks/useHideSeekInspect';
import { useHideSeekQuality } from '../hooks/useHideSeekQuality';
import { useHideSeekShortcuts } from '../hooks/useHideSeekShortcuts';
import { useHudCover } from '../hooks/useHudCover';
import { useTeamSchemas } from '../hooks/useTeamSchema';
import { hideSeekSession } from '../session/HideSeekSession';
import { InputsCard } from './hud/InputsCard';
import { SandboxCard } from './hud/SandboxCard';
import { ViewportHud } from './hud/ViewportHud';
import { NewRunDialog } from './newrun/NewRunDialog';
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
  const cards = useRef<HTMLDivElement>(null);
  const schemas = useTeamSchemas();
  useHideSeekShortcuts(openNewRun);
  useCameraPreference();
  useHudCover(viewport, cards);
  useHideSeekInspect(ready);
  // ?quality=low|medium|high|ultra pins the render tier over Settings, handy on slow machines and in browser tests.
  useHideSeekQuality(params.get('quality'));

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
    // Under lg the viewport and the side panel stack taller than the screen, so the stack scrolls.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-w-[600px]">
        <div ref={viewport} className="@container relative min-h-0 flex-1 bg-bg" data-testid="hs-viewport" data-tour="viewport">
          {streams ? (
            <HideSeekCanvas getFeed={getFeed} feeds={feeds} schemas={schemas} onMoveBox={onMoveBox} onToggleLock={onToggleLock} />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-muted">Starting...</div>
          )}
          {streams && <ViewportHud viewport={viewport} />}
          <div ref={cards} className="pointer-events-auto absolute bottom-3 left-3 flex flex-col items-start gap-2">
            <InputsCard />
            <SandboxCard />
          </div>
        </div>
        <HideSeekToolbar onNewRun={openNewRun} />
      </div>
      {/* The props mirror the panel's classes below. 380 px keeps every tab visible, and with the viewport's 600 px it fits a 1024 px (lg) window. */}
      <ResizeHandle id="hideseek" cssVar="--panel-w" pane="after" defaultSize={400} min={380} max={900} label="Resize the side panel" />
      <aside data-tour="panel" className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[var(--panel-w,400px)] lg:min-w-[380px] lg:shrink lg:border-t-0 lg:border-l">
        <SidePanel />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      <Walkthrough tour={HIDE_SEEK_TOUR} ready={ready} />
    </div>
  );
}
