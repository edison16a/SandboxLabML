'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { racingSession } from '../../session/RacingSession';
import { useRacingLab } from '../../state/labStore';
import { overlayButton } from './overlay';

const STRIDE = RACING_SNAPSHOT.stride;

/** Cars still driving and the leader's distance, read from the ghost stream four times a second. */
function useRace(): { driving: number; total: number; leader: number } {
  const [race, setRace] = useState({ driving: 0, total: 0, leader: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const stream = racingSession().streams?.ghosts;
      const buf = stream?.curr?.buffer;
      if (!stream || !buf) return setRace((r) => (r.total === 0 ? r : { driving: 0, total: 0, leader: 0 }));
      let driving = 0;
      let leader = 0;
      for (let i = 0; i < stream.count; i++) {
        if (buf[i * STRIDE + 6] === 0) driving++;
        leader = Math.max(leader, buf[i * STRIDE + 7]);
      }
      setRace((r) => (r.driving === driving && r.total === stream.count && Math.abs(r.leader - leader) < 1 ? r : { driving, total: stream.count, leader }));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return race;
}

/** Play, pause and restart for the Sandbox race, with a live count of cars still going. */
export function RaceBar() {
  const paused = useRacingLab((s) => s.sandboxPaused);
  const race = useRace();
  const controls = () => racingSession().sandbox;
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={paused ? 'Resume the race' : 'Pause the race'} shortcut="Space">
        <Button size="icon-sm" variant="secondary" className={overlayButton} onClick={() => void controls()?.setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <Play /> : <Pause />}
        </Button>
      </Tooltip>
      <Tooltip content="Back to the grid and start again" shortcut="R">
        <Button size="icon-sm" variant="secondary" className={overlayButton} onClick={() => void controls()?.restart()} aria-label="Restart the race">
          <RotateCcw />
        </Button>
      </Tooltip>
      <div className="ml-auto flex items-baseline gap-3 text-[12px] text-white/60">
        <span>
          <span className="tabular font-mono text-white">{race.driving}</span> of {race.total} driving
        </span>
        <span>
          Leader <span className="tabular font-mono text-white">{Math.round(race.leader)} m</span>
        </span>
      </div>
    </div>
  );
}
