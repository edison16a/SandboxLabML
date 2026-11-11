import { drivingSession } from '@/features/driving/session/DrivingSession';
import { useDrivingLab } from '@/features/driving/state/labStore';
import { isWatchSpeed } from '@/workers/shared/protocol';

const driving = () => useDrivingLab.getState();

/**
 * Starts Driving training when it is not running, for the steps about
 * generations, levels and speed. Someone who pressed Next instead of Train
 * would otherwise read about counters and charts that never move.
 */
export async function keepDrivingTraining(): Promise<void> {
  if (driving().status !== 'running') await drivingSession().start();
}

/** True while Driving trains at Turbo or Max, flat out. */
export function drivingFlatOut(): boolean {
  return driving().status === 'running' && !isWatchSpeed(driving().speed);
}

/**
 * Brings the Driving lab back to a speed where the generation drives on
 * screen, and keeps it training, so the inputs readout and the network's
 * live links have a real SUV to show.
 */
export async function watchDrivingLive(): Promise<void> {
  if (!isWatchSpeed(driving().speed)) await drivingSession().setSpeed('1x');
  await keepDrivingTraining();
}
