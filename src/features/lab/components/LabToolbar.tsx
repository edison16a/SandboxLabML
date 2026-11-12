'use client';

import { Pause, Play, Plus, SkipForward } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { Badge } from '@/ui/primitives/Badge';
import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';
import { RunScriptBadge } from '@/features/scripts/RunScriptBadge';
import { useLab, useLabContext } from '../LabContext';
import { SandboxButton, type SandboxSwitch } from './SandboxButton';
import { SpeedBar } from './SpeedBar';
import { RunSwitcher } from './RunSwitcher';
import { SavingChip } from './SavingChip';
import { ToolbarMenu } from './ToolbarMenu';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

interface Props {
  onNewRun: () => void;
  /** The lab's tour, which the help menu replays. */
  tour: string;
  /** The lab's keyboard shortcuts, listed in the help menu. */
  shortcuts: ReadonlyArray<readonly [string, string]>;
  sandbox: SandboxSwitch;
}

/**
 * Play, step, speed and run info along the bottom of the viewport. When
 * the row is narrow, as on a phone, the speed becomes one button and the
 * Sandbox, New run and the tour move into a menu at the end, so nothing
 * hides off the edge.
 */
export function LabToolbar({ onNewRun, tour, shortcuts, sandbox }: Props) {
  const { session } = useLabContext();
  const status = useLab((s) => s.status);
  const speed = useLab((s) => s.speed);
  const run = useLab((s) => s.run);
  const gen = useLab((s) => s.liveGeneration);
  const records = useLab((s) => s.records);
  const simSeconds = records.reduce((s, r) => s + r.simSeconds, 0);
  const running = status === 'running';

  return (
    // The row reads its own width, not the window's, since the side panel can be dragged wider. If it
    // still runs out of room it scrolls sideways rather than making the whole page wider than the screen.
    <div className="no-scrollbar @container flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-t border-border bg-bg px-3 [&>*]:shrink-0">
      <Tooltip content={running ? 'Pause training' : 'Start training'} shortcut="Space">
        <Button
          variant="primary"
          size="lg"
          className="w-28 justify-center"
          data-tour="train"
          // Starting closes a Sandbox first, so Train always trains.
          onClick={() => void (running ? session.pause() : session.start())}
          disabled={!run}
          aria-label={running ? 'Pause' : 'Train'}
        >
          {running ? <Pause /> : <Play />}
          {running ? 'Pause' : 'Train'}
        </Button>
      </Tooltip>
      <Tooltip content="Step one generation" shortcut="S">
        <Button size="icon" variant="outline" onClick={() => void session.start(1)} disabled={!run || running} aria-label="Step one generation">
          <SkipForward />
        </Button>
      </Tooltip>
      <span data-tour="speed">
        <SpeedBar value={speed} onChange={(v) => void session.setSpeed(v)} />
      </span>
      <div className="hidden min-w-0 items-center gap-4 pl-2 @min-[56rem]:flex">
        <div data-tour="generation" className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted">Generation</span>
          <span className="tabular font-mono text-[15px] font-semibold">{gen + 1}</span>
        </div>
        <div className="hidden flex-col leading-tight @min-[60rem]:flex">
          <span className="text-[11px] text-muted">Simulated</span>
          <span className="tabular font-mono text-[13px]">{formatDuration(simSeconds)}</span>
        </div>
        {status === 'error' && <Badge tone="danger">Stopped on an error</Badge>}
      </div>
      <SavingChip />
      <RunScriptBadge run={run} generation={gen} running={running} />
      <div className="ml-auto flex min-w-0 items-center gap-2 @max-[40rem]:hidden">
        <RunSwitcher />
        <SandboxButton sandbox={sandbox} />
        <LabHelpMenu tour={tour} shortcuts={shortcuts} />
        <Tooltip content="Start a new run" shortcut="N">
          <Button variant="outline" onClick={onNewRun} aria-label="New run">
            <Plus />
            <span className="@max-[52rem]:hidden">New run</span>
          </Button>
        </Tooltip>
      </div>
      <div className="ml-auto @min-[40rem]:hidden">
        <ToolbarMenu sandbox={sandbox} tour={tour} onNewRun={onNewRun} />
      </div>
    </div>
  );
}
