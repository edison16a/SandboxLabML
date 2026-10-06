'use client';

import { FlaskConical, Pause, Play, Plus, SkipForward } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { Badge } from '@/ui/primitives/Badge';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { SpeedBar } from './SpeedBar';

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
    <div className="flex h-14 shrink-0 items-center gap-3 border-t border-border bg-bg px-3">
      <Tooltip content={running ? 'Pause training' : 'Start training'} shortcut="Space">
        <Button
          variant="primary"
          size="lg"
          className="w-28 justify-center"
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
      <SpeedBar value={speed} onChange={(v) => void session.setSpeed(v)} />
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
        {run && (
          <span className="hidden max-w-56 truncate text-[13px] text-muted lg:inline" title={run.name}>
            {run.name}
          </span>
        )}
        <Tooltip content="Replay champions on a track you can edit, and switch inputs off">
          <Button variant={mode === 'sandbox' ? 'primary' : 'outline'} onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())} disabled={!records.length}>
            <FlaskConical />
            Sandbox
          </Button>
        </Tooltip>
        <Tooltip content="Start a new run" shortcut="N">
          <Button variant="outline" onClick={onNewRun}>
            <Plus />
            New run
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
