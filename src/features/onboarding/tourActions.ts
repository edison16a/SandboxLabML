import { racingSession } from '@/features/racing/session/RacingSession';
import { useRacingLab } from '@/features/racing/state/labStore';
import { isWatchSpeed } from '@/workers/shared/protocol';

const racing = () => useRacingLab.getState();

/**
 * Brings the Racing lab back to a speed where one car drives on screen, and
 * keeps it training. Turbo and Max train out of sight, so the inputs readout
 * and the network's live links would show dashes or sit still. Starting an
 * already running lab does nothing, so steps can call this freely.
 */
export async function watchRacingLive(): Promise<void> {
  const session = racingSession();
  if (!isWatchSpeed(racing().speed)) await session.setSpeed('1x');
  if (racing().status !== 'running') await session.start();
}
