'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { STATUS_ARRIVED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshotLayout';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { drivingSession } from '../../session/DrivingSession';
import { useDrivingLab } from '../../state/labStore';
import { overlayButton } from './overlay';

const STRIDE = DRIVING_SNAPSHOT.stride;

interface Trip {
  total: number;
  driving: number;
  arrived: number;
}

/** SUVs still driving and arrived, read from the ghost stream four times a second. */
function useTrip(): Trip {
  const [trip, setTrip] = useState<Trip>({ total: 0, driving: 0, arrived: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const stream = drivingSession().streams?.ghosts;
      const buf = stream?.curr?.buffer;
      if (!stream || !buf) return setTrip((t) => (t.total === 0 ? t : { total: 0, driving: 0, arrived: 0 }));
      let driving = 0;
      let arrived = 0;
      for (let i = 0; i < stream.count; i++) {
        const status = buf[i * STRIDE + SNAP.status];
        if (status === STATUS_DRIVING) driving++;
        else if (status === STATUS_ARRIVED) arrived++;
      }
      setTrip((t) => (t.driving === driving && t.arrived === arrived && t.total === stream.count ? t : { total: stream.count, driving, arrived }));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return trip;
}

/** Play, pause and restart for the Sandbox trip, with a live count of SUVs driving and arrived. */
export function SandboxBar() {
  const paused = useDrivingLab((s) => s.sandboxPaused);
  const trip = useTrip();
  const controls = () => drivingSession().sandbox;
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip content={paused ? 'Resume the trip' : 'Pause the trip'} shortcut="Space">
        <Button size="icon-sm" variant="secondary" className={overlayButton} onClick={() => void controls()?.setPaused(!paused)} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <Play /> : <Pause />}
        </Button>
      </Tooltip>
      <Tooltip content="Back to the start and drive again" shortcut="R">
        <Button size="icon-sm" variant="secondary" className={overlayButton} onClick={() => void controls()?.restart()} aria-label="Restart the trip">
          <RotateCcw />
        </Button>
      </Tooltip>
      <div className="ml-auto flex items-baseline gap-3 text-[12px] text-white/60">
        <span>
          <span className="tabular font-mono text-white">{trip.driving}</span> of {trip.total} driving
        </span>
        <span>
          <span className="tabular font-mono text-white">{trip.arrived}</span> arrived
        </span>
      </div>
    </div>
  );
}
