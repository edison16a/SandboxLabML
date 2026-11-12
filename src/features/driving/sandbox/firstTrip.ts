import { mixSeed } from '@/engine/core/rng';
import { drivingInputsOf } from '@/engine/driving/run/inputs';
import type { DrivingRunResult } from '@/engine/driving/run/results';
import type { DrivingRunSetup } from '@/engine/driving/run/setup';
import { sandboxCapacity, sandboxSetup, type SandboxTrip } from '@/engine/driving/sandbox';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';
import { fieldScene } from './field';
import type { TrainedModel } from './model';
import type { DrivingSandbox } from './state';

/** Routes tried for the first trip. The model arrives safely with every copy on about three in four, so twelve all failing is very rare. */
export const FIRST_TRIP_TRIES = 12;

/** Plays a scene off screen and gives each SUV's result, as the replay worker's rehearse does. */
export type Rehearse = (setup: DrivingRunSetup, specs: GhostSpec[]) => Promise<readonly unknown[]>;

/** Copies of the trained model, front to back. They run the built in rules, as every preset's reward does. */
export function modelSpecs(t: TrainedModel, copies: number): GhostSpec[] {
  return Array.from({ length: copies }, (_, slot) => ({ generation: t.model.generation, genome: t.genome, seed: t.model.seed, scriptSource: null, slot }));
}

/** The setup the Sandbox drives the trained model on: the trip with as many copies as fit on its first lane. */
export function modelSetup(trip: SandboxTrip, t: TrainedModel, copies: number): { setup: DrivingRunSetup; specs: GhostSpec[] } {
  const specs = modelSpecs(t, Math.min(sandboxCapacity(trip), copies));
  return { setup: { trips: [sandboxSetup(trip, specs.length)], inputs: t.model.inputs, scriptSource: null }, specs };
}

/**
 * The scene the Sandbox plays: the trained model's lineup (the very one
 * checkedTrip rehearses) or the run's champions, on the chosen trip, with
 * any lesioned inputs forced. `trained` is null to drive the champions.
 */
export function sandboxScene(sb: DrivingSandbox, run: RunConfig, records: GenerationRecord[], trained: TrainedModel | null, lesions: Record<number, number>): { setup: DrivingRunSetup; specs: GhostSpec[] } {
  const lineup = trained ? modelSetup(sb.trip, trained, sb.modelCopies) : fieldSetup(sb, run, records);
  const lesion = Object.entries(lesions).map(([k, v]) => [Number(k), v] as [number, number]);
  return { setup: { ...lineup.setup, lesion: lesion.length ? lesion : undefined }, specs: lineup.specs };
}

/** The run's champions lined up on the trip, as the field asks. An empty field still builds the trip, for its streets. */
function fieldSetup(sb: DrivingSandbox, run: RunConfig, records: GenerationRecord[]): { setup: DrivingRunSetup; specs: GhostSpec[] } {
  const { specs } = fieldScene(run, records, sb.field, sandboxCapacity(sb.trip));
  return { setup: { trips: [sandboxSetup(sb.trip, Math.max(1, specs.length))], inputs: drivingInputsOf(run), scriptSource: null }, specs };
}

/**
 * The trip the Sandbox first shows the trained model on. The model is
 * good, not perfect, and a newcomer's first look should be skilled
 * driving rather than a stall that loops forever. So it tries the trip's
 * own route first, then a few others in a fixed order, and keeps the
 * first one every copy arrives on safely. When none does it keeps the
 * trip as it was.
 */
export async function checkedTrip(trip: SandboxTrip, t: TrainedModel, copies: number, rehearse: Rehearse): Promise<SandboxTrip> {
  for (let k = 0; k < FIRST_TRIP_TRIES; k++) {
    const candidate = { ...trip, seed: k === 0 ? trip.seed : mixSeed(trip.seed, k) };
    const { setup, specs } = modelSetup(candidate, t, copies);
    const results = (await rehearse(setup, specs)) as readonly DrivingRunResult[];
    if (results.length > 0 && results.every((r) => r.safeArrivals === r.trips)) return candidate;
  }
  return trip;
}
