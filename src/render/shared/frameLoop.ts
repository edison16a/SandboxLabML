import { fpsCap, useSettings } from '@/features/settings/settingsStore';

/**
 * What a viewport is doing right now. Live scenes animate every frame, idle
 * ones only draw when something changes, and a held one keeps its last
 * frame on screen while training has the machine.
 */
export type LoopActivity = 'live' | 'idle' | 'held';

export interface FrameLoop {
  activity: LoopActivity;
  /** Frames per second while live, or null to draw on every display frame. */
  fps: number | null;
  /** The value for the Canvas frameloop prop. */
  frameloop: 'always' | 'demand' | 'never';
}

/**
 * Combines a viewport's activity with the frame rate from Settings. A
 * capped live scene runs with frameloop never and FramePacer drives it, so
 * stray invalidate calls cannot draw past the cap. Idle scenes keep
 * drawing on demand at once, so a click or a camera drag still answers
 * right away.
 */
export function useFrameLoop(activity: LoopActivity): FrameLoop {
  const fps = useSettings((s) => fpsCap(s.frameRate));
  const frameloop = activity === 'held' ? 'never' : activity === 'idle' ? 'demand' : fps === null ? 'always' : 'never';
  return { activity, fps, frameloop };
}
