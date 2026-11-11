import type { DrivingContent } from '@/engine/driving/run/content';
import { DEFAULT_DRIVING_SETTINGS } from '@/engine/driving/run/settings';
import type { SandboxTrip } from '@/engine/driving/sandbox';
import type { FieldEntry } from './field';

/**
 * What the Driving Sandbox is set up to drive: the trip, the run's
 * champions lined up at its start, or the shipped trained model instead.
 * It lives in the lab store and survives closing and reopening the
 * Sandbox, so the user comes back to what they last set up.
 */
export interface DrivingSandbox {
  trip: SandboxTrip;
  field: FieldEntry[];
  /** Drive the shipped trained model instead of the run's champions. */
  model: boolean;
  /** Copies of the trained model that line up. */
  modelCopies: number;
}

/** Copies of the trained model the Sandbox starts with: one in front, two behind, so the start shows how it reacts to a queue. */
export const STARTING_MODEL_COPIES = 3;

/**
 * The first Sandbox for a run: the city and level training is on now, a
 * fresh route, and the given champions. A run with nothing trained yet
 * starts on the trained model, so there is always something skilled to see.
 */
export function firstSandbox(content: DrivingContent | null, field: FieldEntry[]): DrivingSandbox {
  return {
    trip: { city: content?.city ?? DEFAULT_DRIVING_SETTINGS.city, level: Math.max(2, content?.level ?? 2), seed: content?.tripSeed ?? 1, destination: null },
    field,
    model: field.length === 0,
    modelCopies: STARTING_MODEL_COPIES,
  };
}
