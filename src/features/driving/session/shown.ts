import { isWatchSpeed, type SpeedMode } from '@/workers/shared/protocol';
import type { Focus, LabState, ViewMode } from '@/features/lab/state/labState';

/**
 * Which stream the viewport shows as its population. The live generation
 * streams only at watch speeds; under Turbo and Max (and in the Sandbox,
 * and when the view asks for champions only) the viewport replays past
 * champions instead, so something real is always driving.
 */
export function shownStream(s: { mode: LabState['mode']; view: ViewMode; speed: SpeedMode }): 'population' | 'ghosts' {
  return s.mode === 'sandbox' || s.view === 'overlay' || !isWatchSpeed(s.speed) ? 'ghosts' : 'population';
}

/**
 * The index the camera should follow in the shown stream, or -1 for the
 * best performer. A focus on the other stream falls back to the leader.
 */
export function focusIndex(focus: Focus, shown: 'population' | 'ghosts', ghostGenerations: readonly number[]): number {
  if (focus.kind === 'agent' && shown === 'population') return focus.index;
  if (focus.kind === 'ghost' && shown === 'ghosts') return ghostGenerations.indexOf(focus.generation);
  return -1;
}

/** The focus a click on an SUV of the shown stream asks for. */
export function pickedFocus(index: number, shown: 'population' | 'ghosts', ghostGenerations: readonly number[]): Focus {
  if (shown === 'population') return { kind: 'agent', index };
  const generation = ghostGenerations[index];
  return generation === undefined ? { kind: 'champion' } : { kind: 'ghost', generation };
}
