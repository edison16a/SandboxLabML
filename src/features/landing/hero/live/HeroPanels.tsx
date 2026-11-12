'use client';

import { DRIVING_OUTPUTS } from '@/engine/driving/sensors/inputSchema';
import { NAVIGATION_OUTPUTS } from '@/engine/navigation/sensors/inputSchema';
import type { DriveFeed } from '@/render/hero/driving/driveFeed';
import type { RunFeed } from '@/render/hero/navigation/runFeed';
import { cn } from '@/ui/cn';
import { BrainPanel } from './BrainPanel';
import { useDriveStatus, useRunStatus } from './useHeroStatus';

const DRIVE_OUTPUTS = DRIVING_OUTPUTS.map((o) => o.label);
const RUN_OUTPUTS = NAVIGATION_OUTPUTS.map((o) => o.label);

function DrivePanel({ feed }: { feed: DriveFeed }) {
  const line = useDriveStatus(feed);
  return <BrainPanel title="SUV brain" feed={feed} outputLabels={DRIVE_OUTPUTS} status={line.status} detail={line.detail} />;
}

function RunPanel({ feed }: { feed: RunFeed }) {
  const line = useRunStatus(feed);
  return <BrainPanel title="Runner brain" feed={feed} outputLabels={RUN_OUTPUTS} status={line.status} detail={line.detail} />;
}

/**
 * One brain card per scene, each in its own scene's outer corner: the
 * SUV's bottom left, the runner's bottom right. Stacked, the SUV's card
 * moves to the top left so it stays in its own scene. Each card shows the
 * brain in charge lighting up live, with a line on what it is doing.
 */
export function HeroPanels({ stacked, drive, run }: { stacked: boolean; drive: DriveFeed | null; run: RunFeed | null }) {
  return (
    <>
      {drive && (
        <div data-hero-card="drive" className={cn('absolute left-6', stacked ? 'top-6' : 'bottom-6')}>
          <DrivePanel feed={drive} />
        </div>
      )}
      {run && (
        <div data-hero-card="run" className="absolute right-6 bottom-6">
          <RunPanel feed={run} />
        </div>
      )}
    </>
  );
}
