'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_STATUS } from '@/engine/navigation/snapshot';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { navigationSession } from '../../session/NavigationSession';
import { useNavigationLab } from '../../state/labStore';
import { glassButton } from './glass';

const STRIDE = NAVIGATION_SNAPSHOT.stride;

interface Tally {
  running: number;
  finished: number;
  died: number;
  total: number;
}

/** Runners still going, finished and dead, read from the replay stream four times a second. */
function useTally(): Tally {
  const [tally, setTally] = useState<Tally>({ running: 0, finished: 0, died: 0, total: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const stream = navigationSession().streams?.ghosts;
      const buf = stream?.curr?.buffer;
      const next: Tally = { running: 0, finished: 0, died: 0, total: buf && stream ? stream.count : 0 };
      for (let i = 0; i < next.total; i++) {
        const status = buf![i * STRIDE + SNAP_STATUS];
        if (status === NAV_RUNNING) next.running++;
        else if (status === NAV_FINISHED) next.finished++;
        else if (status === NAV_DIED) next.died++;
      }
      setTally((t) => (t.running === next.running && t.finished === next.finished && t.died === next.died && t.total === next.total ? t : next));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return tally;
}

/** Play, pause and restart for the Sandbox, with a live count of the runners. */
export function RunBar() {
  const paused = useNavigationLab((s) => s.sandbox.paused);
  const tally = useTally();
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
          <span className="tabular font-mono text-white">{tally.running}</span> running
        </span>
        <span>
          <span className="tabular font-mono text-white">{tally.finished}</span> finished
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
