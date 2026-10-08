'use client';

import { FlaskConical, Pause, Play, Plus, SkipForward } from 'lucide-react';
import { Badge } from '@/ui/primitives/Badge';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { hideSeekSession } from '../../session/HideSeekSession';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { HsSpeedBar } from './HsSpeedBar';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** Train, step, speed, the Sandbox and run info along the bottom of the viewport. */
export function HideSeekToolbar({ onNewRun }: { onNewRun: () => void }) {
  const status = useHideSeekLab((s) => s.status);
  const speed = useHideSeekLab((s) => s.speed);
  const run = useHideSeekLab((s) => s.run);
  const gen = useHideSeekLab((s) => s.liveGeneration);
  const records = useHideSeekLab((s) => s.records);
  const mode = useHideSeekLab((s) => s.mode);
  const blocked = useHideSeekLab((s) => s.replayBlocked);
  const simSeconds = records.reduce((s, r) => s + r.simSeconds, 0);
  const running = status === 'running';
  const session = hideSeekSession();

  return (
    // The row reads its own width, not the window's, since the side panel can be dragged wider. On a
    // phone it scrolls sideways instead of making the whole page wider than the screen.
    <div className="no-scrollbar @container flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-bg px-3 [&>*]:shrink-0">
      {/* In the Sandbox, Space runs the match instead, so the Train button shows no key there. */}
      <Tooltip content={running ? 'Pause training' : 'Start training'} shortcut={mode === 'sandbox' ? undefined : 'Space'}>
        <Button variant="primary" size="lg" className="w-28 justify-center" onClick={() => void (running ? session.pause() : session.start())} disabled={!run} aria-label={running ? 'Pause' : 'Train'}>
          {running ? <Pause /> : <Play />}
          {running ? 'Pause' : 'Train'}
        </Button>
      </Tooltip>
      <Tooltip content="Step one generation" shortcut="S">
        <Button size="icon" variant="outline" onClick={() => void session.start(1)} disabled={!run || running} aria-label="Step one generation">
          <SkipForward />
        </Button>
      </Tooltip>
      <HsSpeedBar value={speed} onChange={(v) => void session.setSpeed(v)} />
      <div className="hidden min-w-0 items-center gap-4 pl-2 @min-[56rem]:flex">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted">Generation</span>
          <span className="tabular font-mono text-[15px] font-semibold">{gen + 1}</span>
        </div>
        <div className="hidden flex-col leading-tight @min-[60rem]:flex">
          <span className="text-[11px] text-muted">Simulated</span>
          <span className="tabular font-mono text-[13px]">{formatDuration(simSeconds)}</span>
        </div>
        {status === 'error' && <Badge tone="danger">Stopped on an error</Badge>}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {run && (
          <span className="hidden max-w-56 truncate text-[13px] text-muted @min-[72rem]:inline" title={run.name}>
            {run.name}
          </span>
        )}
        <Tooltip content={mode === 'sandbox' ? 'Back to training' : 'Play your champions in any room'}>
          <Button
            variant={mode === 'sandbox' ? 'secondary' : 'outline'}
            onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())}
            disabled={!run || !records.length || !!blocked}
            aria-pressed={mode === 'sandbox'}
            aria-label="Sandbox"
          >
            <FlaskConical />
            <span className="@max-[52rem]:hidden">Sandbox</span>
          </Button>
        </Tooltip>
        <Tooltip content="Start a new run" shortcut="N">
          <Button variant="outline" onClick={onNewRun} aria-label="New run">
            <Plus />
            <span className="@max-[52rem]:hidden">New run</span>
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
