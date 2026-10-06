'use client';

import { FlaskConical, Pause, Play, Plus, SkipForward } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { Badge } from '@/ui/primitives/Badge';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { SpeedBar } from './SpeedBar';
import { HelpMenu } from './HelpMenu';
import { RunSwitcher } from './RunSwitcher';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** Play, step, speed and run info along the bottom of the viewport. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  const status = useRacingLab((s) => s.status);
  const speed = useRacingLab((s) => s.speed);
  const run = useRacingLab((s) => s.run);
  const gen = useRacingLab((s) => s.liveGeneration);
  const records = useRacingLab((s) => s.records);
  const mode = useRacingLab((s) => s.mode);
  const simSeconds = records.reduce((s, r) => s + r.simSeconds, 0);
  const running = status === 'running';
  const session = racingSession();

  return (
    // On a phone the row scrolls sideways instead of making the whole page wider than the screen.
    <div className="no-scrollbar flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-bg px-3 [&>*]:shrink-0">
      <Tooltip content={running ? 'Pause training' : 'Start training'} shortcut="Space">
        <Button
          variant="primary"
          size="lg"
          className="w-28 justify-center"
          data-tour="train"
          onClick={() => void (running ? session.pause() : mode === 'sandbox' ? session.exitSandbox().then(() => session.start()) : session.start())}
          disabled={!run}
          aria-label={running ? 'Pause' : 'Train'}
        >
          {running ? <Pause /> : <Play />}
          {running ? 'Pause' : 'Train'}
        </Button>
      </Tooltip>
      <Tooltip content="Run exactly one generation" shortcut="S">
        <Button size="icon" variant="outline" onClick={() => void session.start(1)} disabled={!run || running} aria-label="Step one generation">
          <SkipForward />
        </Button>
      </Tooltip>
      <span data-tour="speed">
        <SpeedBar value={speed} onChange={(v) => void session.setSpeed(v)} />
      </span>
      <div className="hidden min-w-0 items-center gap-4 pl-2 md:flex">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted">Generation</span>
          <span className="tabular font-mono text-[15px] font-semibold">{gen + 1}</span>
        </div>
        <div className="hidden flex-col leading-tight xl:flex">
          <span className="text-[11px] text-muted">Simulated</span>
          <span className="tabular font-mono text-[13px]">{formatDuration(simSeconds)}</span>
        </div>
        {status === 'error' && <Badge tone="danger">Stopped on an error</Badge>}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <RunSwitcher />
        <Tooltip content="Replay champions on a track you can edit, and switch inputs off">
          <Button data-tour="sandbox" variant={mode === 'sandbox' ? 'primary' : 'outline'} onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())} disabled={!records.length} aria-label="Sandbox">
            <FlaskConical />
            <span className="max-sm:hidden">Sandbox</span>
          </Button>
        </Tooltip>
        <HelpMenu />
        <Tooltip content="Start a new run" shortcut="N">
          <Button variant="outline" onClick={onNewRun} aria-label="New run">
            <Plus />
            <span className="max-sm:hidden">New run</span>
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
