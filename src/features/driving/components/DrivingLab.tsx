'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { drivingModule } from '@/engine/driving/module';
import { InputsCard } from '@/features/lab/components/InputsCard';
import { InputsTab } from '@/features/lab/components/InputsTab';
import { SidePanel } from '@/features/lab/components/SidePanel';
import { useLabTier } from '@/features/lab/hooks/useLabTier';
import { useRunBootstrap } from '@/features/lab/hooks/useRunBootstrap';
import { LabProvider, type LabContextValue } from '@/features/lab/LabContext';
import type { LabStoreApi } from '@/features/lab/state/labState';
import { DRIVING_TOUR } from '@/features/onboarding/drivingTour';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { LoadingCover } from '@/ui/feedback/LoadingCover';
import { ResizeHandle } from '@/ui/split/ResizeHandle';
import { Walkthrough } from '@/ui/walkthrough/Walkthrough';
import { defaultDrivingRun, LAST_RUN_KEY } from '../hooks/defaultRun';
import { useDrivingInspect } from '../hooks/useDrivingInspect';
import { useDrivingShortcuts } from '../hooks/useDrivingShortcuts';
import { NewRunDialog } from '../newrun/NewRunDialog';
import { DrivingProgress } from '../progress/DrivingProgress';
import { drivingSession } from '../session/DrivingSession';
import { useDrivingLab } from '../state/labStore';
import { DrivingViewport } from './DrivingViewport';
import { LabToolbar } from './LabToolbar';
import { SandboxPanel } from './sandbox/SandboxPanel';
import { ViewportHud } from './ViewportHud';

/** The Driving lab: the shared lab parts bound to the Driving store and session, around the city. */
export function DrivingLab() {
  // The Driving store holds more than the shared fields; the shared parts only touch theirs.
  const lab = useMemo<LabContextValue>(() => ({ env: 'driving', module: drivingModule, api: useDrivingLab as unknown as LabStoreApi, session: drivingSession(), lastRunKey: LAST_RUN_KEY, agentNoun: 'SUV' }), []);
  return (
    <LabProvider value={lab}>
      <DrivingLabBody />
    </LabProvider>
  );
}

/** Viewport, controls and the side panel. */
function DrivingLabBody() {
  const params = useSearchParams();
  const ready = useRunBootstrap(params.get('run'), defaultDrivingRun);
  const [newRun, setNewRun] = useState(false);
  // False until the city has drawn its first frames.
  const [sceneReady, setSceneReady] = useState(false);
  const openNewRun = useCallback(() => setNewRun(true), []);
  const pendingScript = useTrainScriptParam('driving', params, openNewRun);
  useDrivingShortcuts(openNewRun);
  // ?quality=low|medium|high|ultra pins the render tier over Settings, handy on slow machines and in browser tests.
  useLabTier(params.get('quality'));
  const streams = ready ? drivingSession().streams : null;
  useDrivingInspect(streams);

  return (
    // Under lg the viewport and the side panel stack taller than the screen, so the stack scrolls.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-w-[600px]">
        <div data-tour="viewport" className="relative min-h-0 flex-1 bg-[#b9cfe6]">
          {streams ? <DrivingViewport streams={streams} onReady={setSceneReady} ultra={params.get('quality') === 'ultra'} /> : <div className="h-full bg-bg" />}
          <LoadingCover loading={!streams || !sceneReady} label={streams ? 'Building the city' : 'Starting the lab'} />
          {streams && <ViewportHud streams={streams} />}
          <InputsCard />
          <SandboxPanel />
        </div>
        <LabToolbar onNewRun={openNewRun} />
      </div>
      {/* The props mirror the panel's classes below. 380 px keeps every tab visible, and with the viewport's 600 px it fits a 1024 px (lg) window. */}
      <ResizeHandle id="driving" cssVar="--panel-w" pane="after" defaultSize={400} min={380} max={900} label="Resize the side panel" />
      <aside data-tour="panel" className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[var(--panel-w,400px)] lg:min-w-[380px] lg:shrink lg:border-t-0 lg:border-l">
        <SidePanel progressExtra={<DrivingProgress />} inputs={<InputsTab scopes={false} />} />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      <Walkthrough tour={DRIVING_TOUR} ready={ready && sceneReady} />
    </div>
  );
}
