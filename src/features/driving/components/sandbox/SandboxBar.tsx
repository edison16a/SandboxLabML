'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { drivingSession } from '../../session/DrivingSession';
import { NO_TRIP, readTrip, tripOver, type TripCount } from '../../sandbox/tripCount';
import { useDrivingLab } from '../../state/labStore';
import { overlayButton } from './overlay';

/** The trip's count from the ghost stream four times a second (see readTrip). */
function useTrip(): TripCount {
  const [trip, setTrip] = useState<TripCount>(NO_TRIP);
  useEffect(() => {
    const id = setInterval(() => setTrip((t) => readTrip(drivingSession().streams?.ghosts ?? null, t)), 250);
    return () => clearInterval(id);
  }, []);
  return trip;
}

/**
 * Play, pause and restart for the Sandbox trip, with a live count of SUVs
 * driving and arrived, how many arrived once the trip is over (the replay
 * then drives it again, and restart is at hand), or why none drive.
 */
export function SandboxBar() {
  const paused = useDrivingLab((s) => s.sandboxPaused);
  // The trained model is on its way: say so rather than that nothing drives.
  const waiting = useDrivingLab((s) => (s.sandbox?.model ?? false) && s.trained === null && s.trainedLoad !== 'failed');
  const checking = useDrivingLab((s) => s.sandboxChecking);
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
      {checking || (waiting && trip.total === 0) ? (
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-white/70">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          {checking ? 'Finding a good first trip' : 'Loading the trained model'}
        </span>
      ) : trip.total === 0 ? (
        <span className="ml-auto text-[12px] text-white/60">Nothing to drive yet</span>
      ) : tripOver(trip) ? (
        <div className="ml-auto flex items-baseline gap-3 text-[12px] text-white/60" role="status">
          <span className="text-white/80">Trip over</span>
          <span>
            <span className="tabular font-mono text-white">{trip.arrived}</span> of {trip.total} arrived
          </span>
        </div>
      ) : (
        <div className="ml-auto flex items-baseline gap-3 text-[12px] text-white/60">
          <span>
            <span className="tabular font-mono text-white">{trip.driving}</span> of {trip.total} driving
          </span>
          <span>
            <span className="tabular font-mono text-white">{trip.arrived}</span> arrived
          </span>
        </div>
      )}
    </div>
  );
}
