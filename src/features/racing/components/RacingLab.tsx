'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { TelemetryStrip } from '@/features/charts/TelemetryStrip';
import { RacingCanvas } from '@/render/racing/RacingCanvas';
import { useInspectSubscription } from '../hooks/useInspectSubscription';
import { useLabShortcuts } from '../hooks/useLabShortcuts';
import { useRunBootstrap } from '../hooks/useRunBootstrap';
import { useRunSchema } from '../hooks/useRunSchema';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { LabToolbar } from './LabToolbar';
import { NewRunDialog } from './NewRunDialog';
import { RacingTour } from './RacingTour';
import { useTrainScriptParam } from '@/features/scripts/useTrainScriptParam';
import { SidePanel } from './SidePanel';
import { ViewportHud } from './ViewportHud';
import { InputsCard } from './InputsCard';
import { SandboxPanel } from './SandboxPanel';
import { TrackEditor } from '@/render/racing/TrackEditor';
import { InputsTab } from './InputsTab';
import { ModelTab } from './ModelTab';
import { NetworkTab } from './NetworkTab';

/** The Racing lab: viewport, telemetry, controls and the side panel. */
export function RacingLab() {
  const params = useSearchParams();
  const ready = useRunBootstrap(params.get('run'));
  const run = useRacingLab((s) => s.run);
  const trackSpec = useRacingLab((s) => s.trackSpec);
  const mode = useRacingLab((s) => s.mode);
  const sandboxTrack = useRacingLab((s) => s.sandboxTrack);
  const editing = useRacingLab((s) => s.editingTrack);
  const view = useRacingLab((s) => s.view);
  const hasTelemetry = useRacingLab((s) => s.telemetry.length > 0);
  const [newRun, setNewRun] = useState(false);
  const tourSignal = useRacingLab((s) => s.tourSignal);
  const openNewRun = useCallback(() => setNewRun(true), []);
  const pendingScript = useTrainScriptParam('racing', params, openNewRun);
  useLabShortcuts(openNewRun);
  useEffect(() => {
    // ?quality=low|medium|high pins the render tier, handy on slow machines and in browser tests.
    const q = params.get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') useRacingLab.getState().set({ quality: q, activeTier: q });
  }, [params]);
  useInspectSubscription(ready);

  const spec = (mode === 'sandbox' ? sandboxTrack : null) ?? trackSpec ?? run?.racing?.track ?? null;
  const track = useMemo(() => (spec ? buildTrack(spec) : null), [spec]);
  const schema = useRunSchema();
  const streams = ready ? racingSession().streams : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-[#b9cfe6]">
          {track && streams ? (
            <RacingCanvas track={track} population={streams.population} ghosts={streams.ghosts} schema={schema}>
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
            <div className="flex h-full items-center justify-center bg-bg text-[13px] text-muted">Starting the simulation workers...</div>
          )}
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
      <aside data-tour="panel" className="flex h-[70vh] min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:h-auto lg:w-[400px] lg:border-t-0 lg:border-l">
        <SidePanel network={<NetworkTab />} inputs={<InputsTab />} model={<ModelTab />} />
      </aside>
      <NewRunDialog open={newRun} onOpenChange={setNewRun} initialScript={pendingScript} />
      {ready && <RacingTour openSignal={tourSignal} />}
    </div>
  );
}
