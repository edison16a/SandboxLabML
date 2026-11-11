import { navigationSession } from '@/features/navigation/session/NavigationSession';
import { useNavigationLab } from '@/features/navigation/state/labStore';
import { isWatchSpeed } from '@/workers/shared/protocol';

const lab = () => useNavigationLab.getState();

/**
 * Starts Navigation training when it is not running, for the steps about
 * generations and levels, so someone who pressed Next instead of Train
 * does not read about charts that never move. Safe to call while running.
 */
export async function keepNavigationTraining(): Promise<void> {
  if (lab().status !== 'running') await navigationSession().start();
}

/** True while Navigation trains at Turbo or Max, flat out. */
export function navigationFlatOut(): boolean {
  return lab().status === 'running' && !isWatchSpeed(lab().speed);
}

/**
 * Brings the lab back to a speed where the runners play on screen, and
 * keeps it training, so the inputs and the network's links show a live
 * runner rather than dashes.
 */
export async function watchNavigationLive(): Promise<void> {
  if (!isWatchSpeed(lab().speed)) await navigationSession().setSpeed('1x');
  await keepNavigationTraining();
}
