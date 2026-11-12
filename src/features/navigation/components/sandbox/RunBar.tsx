'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { navigationSession } from '../../session/NavigationSession';
import { useNavigationLab } from '../../state/labStore';
import type { LabFeeds } from '../../viewport/labFeeds';
import { useRunnerCounts } from '../useRunnerCounts';
import { glassButton } from './glass';

/**
 * Play, pause and restart for the Sandbox, with a live count of the
 * runners. The count is the HUD's own, so the two always agree, and both
 * show dashes while no runner is on screen.
 */
export function RunBar({ feeds }: { feeds: LabFeeds | null }) {
  const paused = useNavigationLab((s) => s.sandbox.paused);
  const tally = useRunnerCounts(feeds);
  const shown = (n: number) => (tally.watching ? n : '-');
  const control = () => navigationSession().sandbox;
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={paused ? 'Play' : 'Pause'} shortcut="Space">
        <Button size="icon-sm" variant="secondary" className={glassButton} onClick={() => void control()?.setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <Play /> : <Pause />}
        </Button>
      </Tooltip>
      <Tooltip content="Back to the start line" shortcut="R">
        <Button size="icon-sm" variant="secondary" className={glassButton} onClick={() => void control()?.restart()} aria-label="Restart">
          <RotateCcw />
        </Button>
      </Tooltip>
      <div className="ml-auto flex items-baseline gap-3 text-[12px] text-white/60" aria-live="off">
        <span>
          <span className="tabular font-mono text-white">{shown(tally.running)}</span> running
        </span>
        <span>
          <span className="tabular font-mono text-white">{shown(tally.finished)}</span> finished
        </span>
        {tally.died > 0 && (
          <span>
            <span className="tabular font-mono text-danger">{tally.died}</span> died
          </span>
        )}
      </div>
    </div>
  );
}
