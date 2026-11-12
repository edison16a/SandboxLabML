'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { navigationModule } from '@/engine/navigation/module';
import { InputsCard } from '@/features/lab/components/InputsCard';
import { InputsTab } from '@/features/lab/components/InputsTab';
import { ProgressTab } from '@/features/lab/components/ProgressTab';
import { SidePanel } from '@/features/lab/components/SidePanel';
import { useLabTier } from '@/features/lab/hooks/useLabTier';
import { useRunBootstrap } from '@/features/lab/hooks/useRunBootstrap';
import { LabProvider, type LabContextValue } from '@/features/lab/LabContext';
import type { LabStoreApi } from '@/features/lab/state/labState';
import { NAVIGATION_TOUR } from '@/features/onboarding/navigationTour';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { LoadingCover } from '@/ui/feedback/LoadingCover';
import { ResizeHandle } from '@/ui/split/ResizeHandle';
import { Walkthrough } from '@/ui/walkthrough/Walkthrough';
import { defaultNavigationRun, LAST_RUN_KEY } from '../hooks/defaultRun';
import { useLabShortcuts } from '../hooks/useLabShortcuts';
import { useNavInspect } from '../hooks/useNavInspect';
import { CurriculumCharts } from '../progress/CurriculumCharts';
import { navigationSession } from '../session/NavigationSession';
import { useNavigationLab } from '../state/labStore';
import { LabFeeds } from '../viewport/labFeeds';
import { NavigationViewport } from '../viewport/NavigationViewport';
import { LabToolbar } from './LabToolbar';
import { NewRunDialog } from './NewRunDialog';
import { SandboxPanel } from './sandbox/SandboxPanel';
import { ViewportHud } from './ViewportHud';

/** The Navigation lab: the shared lab parts bound to the Navigation store and session, around the course. */
export function NavigationLab() {
  // The Navigation store holds more than the shared fields; the shared parts only touch theirs.
  const lab = useMemo<LabContextValue>(
    () => ({ env: 'navigation', module: navigationModule, api: useNavigationLab as unknown as LabStoreApi, session: navigationSession(), lastRunKey: LAST_RUN_KEY, agentNoun: 'runner' }),
    [],
  );
  return (
    <LabProvider value={lab}>
      <NavigationLabBody />
    </LabProvider>
  );
}

/** Viewport, controls and the side panel. */
function NavigationLabBody() {
  const params = useSearchParams();
  const ready = useRunBootstrap(params.get('run'), defaultNavigationRun);
  const [newRun, setNewRun] = useState(false);
  // False until the course and its runners have drawn.
  const [sceneReady, setSceneReady] = useState(false);
  const openNewRun = useCallback(() => setNewRun(true), []);
  const pendingScript = useTrainScriptParam('navigation', params, openNewRun);
  useLabShortcuts(openNewRun);
  // ?quality=low|medium|high|ultra pins the render tier over Settings, handy on slow machines and in browser tests.
  const quality = params.get('quality');
  useLabTier(quality);
  useNavInspect(ready);
  const streams = ready ? navigationSession().streams : null;
  const feeds = useMemo(() => (streams ? new LabFeeds(streams, useNavigationLab.getState) : null), [streams]);
  useEffect(() => () => feeds?.dispose(), [feeds]);

  return (
    // Under lg the viewport and the side panel stack taller than the screen, so the stack scrolls.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-w-[600px]">
        <div data-tour="viewport" className="relative min-h-0 flex-1 bg-[#dfe3e9]">
          {feeds ? <NavigationViewport feeds={feeds} ultra={quality === 'ultra'} onReady={setSceneReady} /> : <div className="h-full bg-bg" />}
          <LoadingCover loading={!feeds || !sceneReady} label={feeds ? 'Building the course' : 'Starting the lab'} />
          {feeds && <ViewportHud feeds={feeds} />}
          <InputsCard />
          <SandboxPanel feeds={feeds} />
        </div>
        <LabToolbar onNewRun={openNewRun} />
      </div>
      {/* The props mirror the panel's classes below. 380 px keeps every tab visible, and with the viewport's 600 px it fits a 1024 px (lg) window. */}
      <ResizeHandle id="navigation" cssVar="--panel-w" pane="after" defaultSize={400} min={380} max={900} label="Resize the side panel" />
      <aside data-tour="panel" className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[var(--panel-w,400px)] lg:min-w-[380px] lg:shrink lg:border-t-0 lg:border-l">
        <SidePanel progress={<ProgressTab metrics={<CurriculumCharts />} />} inputs={<InputsTab scopes={false} />} />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      <Walkthrough tour={NAVIGATION_TOUR} ready={ready && sceneReady} />
    </div>
  );
}
