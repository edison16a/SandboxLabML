'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { racingModule } from '@/engine/racing/module';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { TelemetryStrip } from '@/features/charts/TelemetryStrip';
import { InputsCard } from '@/features/lab/components/InputsCard';
import { SidePanel } from '@/features/lab/components/SidePanel';
import { useInspectSubscription } from '@/features/lab/hooks/useInspectSubscription';
import { useLabTier } from '@/features/lab/hooks/useLabTier';
import { useRunBootstrap } from '@/features/lab/hooks/useRunBootstrap';
import { useRunSchema } from '@/features/lab/hooks/useRunSchema';
import { LabProvider, type LabContextValue } from '@/features/lab/LabContext';
import type { LabStoreApi } from '@/features/lab/state/labState';
import { RACING_TOUR } from '@/features/onboarding/racingTour';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { RacingCanvas } from '@/render/racing/RacingCanvas';
import { TrackEditor } from '@/render/racing/TrackEditor';
import { LoadingCover } from '@/ui/feedback/LoadingCover';
import { ResizeHandle } from '@/ui/split/ResizeHandle';
import { Walkthrough } from '@/ui/walkthrough/Walkthrough';
import { useLabShortcuts } from '../hooks/useLabShortcuts';
import { defaultRacingRun, LAST_RUN_KEY } from '../hooks/useRunBootstrap';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { LabToolbar } from './LabToolbar';
import { NewRunDialog } from './NewRunDialog';
import { SandboxPanel } from './SandboxPanel';
import { ViewportHud } from './ViewportHud';

/** The Racing lab: the shared lab parts bound to the Racing store and session, around the circuit. */
export function RacingLab() {
  // The Racing store holds more than the shared fields; the shared parts only touch theirs.
  const lab = useMemo<LabContextValue>(() => ({ env: 'racing', module: racingModule, api: useRacingLab as unknown as LabStoreApi, session: racingSession(), lastRunKey: LAST_RUN_KEY, agentNoun: 'car' }), []);
  return (
    <LabProvider value={lab}>
      <RacingLabBody />
    </LabProvider>
  );
}

/** Viewport, telemetry, controls and the side panel. */
function RacingLabBody() {
  const params = useSearchParams();
  const ready = useRunBootstrap(params.get('run'), defaultRacingRun);
  const run = useRacingLab((s) => s.run);
  const trackSpec = useRacingLab((s) => s.trackSpec);
  const mode = useRacingLab((s) => s.mode);
  const sandboxTrack = useRacingLab((s) => s.sandboxTrack);
  const editing = useRacingLab((s) => s.editingTrack);
  const view = useRacingLab((s) => s.view);
  const hasTelemetry = useRacingLab((s) => s.telemetry.length > 0);
  const [newRun, setNewRun] = useState(false);
  // False until the circuit's scenery has drawn, and again while a new track builds it.
  const [sceneReady, setSceneReady] = useState(false);
  const openNewRun = useCallback(() => setNewRun(true), []);
  const pendingScript = useTrainScriptParam('racing', params, openNewRun);
  useLabShortcuts(openNewRun);
  // ?quality=low|medium|high pins the render tier over Settings, handy on slow machines and in browser tests.
  useLabTier(params.get('quality'));
  useInspectSubscription(ready);

  const spec = (mode === 'sandbox' ? sandboxTrack : null) ?? trackSpec ?? run?.racing?.track ?? null;
  const track = useMemo(() => (spec ? buildTrack(spec) : null), [spec]);
  const schema = useRunSchema();
  const streams = ready ? racingSession().streams : null;

  return (
    // Under lg the viewport and the side panel stack taller than the screen, so the stack scrolls.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-w-[600px]">
        <div data-tour="viewport" className="relative min-h-0 flex-1 bg-[#b9cfe6]">
          {track && streams ? (
            <RacingCanvas track={track} population={streams.population} ghosts={streams.ghosts} schema={schema} onReady={setSceneReady}>
              {mode === 'sandbox' && editing && spec && (
                <TrackEditor
                  spec={spec}
                  onChange={(next) => {
                    useRacingLab.getState().set({ sandboxTrack: next });
                    racingSession().sandboxChanged();
                  }}
                />
              )}
            </RacingCanvas>
          ) : (
            <div className="h-full bg-bg" />
          )}
          <LoadingCover loading={!streams || !sceneReady} label={streams ? 'Building the circuit' : 'Starting the lab'} />
          {streams && <ViewportHud population={streams.population} />}
          <InputsCard />
          <SandboxPanel />
        </div>
        {view !== 'population' && hasTelemetry && (
          <div className="h-36 shrink-0 border-t border-border bg-surface px-2 pt-1">
            <TelemetryStrip />
          </div>
        )}
        <LabToolbar onNewRun={openNewRun} />
      </div>
      {/* The props mirror the panel's classes below. 380 px keeps every tab visible, and with the viewport's 600 px it fits a 1024 px (lg) window. */}
      <ResizeHandle id="racing" cssVar="--panel-w" pane="after" defaultSize={400} min={380} max={900} label="Resize the side panel" />
      <aside data-tour="panel" className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[var(--panel-w,400px)] lg:min-w-[380px] lg:shrink lg:border-t-0 lg:border-l">
        <SidePanel />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      <Walkthrough tour={RACING_TOUR} ready={ready && sceneReady} />
    </div>
  );
}
