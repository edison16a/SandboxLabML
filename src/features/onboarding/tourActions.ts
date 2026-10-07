import { hideSeekSession } from '@/features/hideseek/session/HideSeekSession';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
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

/**
 * Starts Hide and Seek training when it is not running, for a step that
 * points at the matches. Someone who pressed Next instead of Train would
 * otherwise read about borders that never change color.
 */
export async function keepHideSeekTraining(): Promise<void> {
  if (useHideSeekLab.getState().status !== 'running') await hideSeekSession().start();
}
