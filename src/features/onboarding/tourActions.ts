import { hideSeekSession } from '@/features/hideseek/session/HideSeekSession';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { racingSession } from '@/features/racing/session/RacingSession';
import { useRacingLab } from '@/features/racing/state/labStore';
import { isWatchSpeed } from '@/workers/shared/protocol';

const racing = () => useRacingLab.getState();

/**
 * Starts Racing training when it is not running, for the steps about
 * generations and speed. Someone who pressed Next instead of Train, or
 * paused, would otherwise read about a counter and charts that never move.
 * Starting a running lab does nothing, so steps can call this freely.
 */
export async function keepRacingTraining(): Promise<void> {
  if (racing().status !== 'running') await racingSession().start();
}

/** True while Racing trains at Turbo or Max, flat out. */
export function racingFlatOut(): boolean {
  return racing().status === 'running' && !isWatchSpeed(racing().speed);
}

/**
 * Brings the Racing lab back to a speed where one car drives on screen, and
 * keeps it training. Turbo and Max train out of sight, so the inputs readout
 * and the network's live links would show dashes or sit still.
 */
export async function watchRacingLive(): Promise<void> {
  if (!isWatchSpeed(racing().speed)) await racingSession().setSpeed('1x');
  await keepRacingTraining();
}

/**
 * Starts Hide and Seek training when it is not running, for a step that
 * points at the matches. Someone who pressed Next instead of Train would
 * otherwise read about borders that never change color.
 */
export async function keepHideSeekTraining(): Promise<void> {
  if (useHideSeekLab.getState().status !== 'running') await hideSeekSession().start();
}
