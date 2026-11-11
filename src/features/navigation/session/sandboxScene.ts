import { generateCourse } from '@/engine/navigation/course/generate';
import { namedCourse } from '@/engine/navigation/course/presets';
import type { CourseSpec } from '@/engine/navigation/course/types';
import type { NavigationSetup } from '@/engine/navigation/pipeline/setup';
import { navigationOf } from '@/engine/navigation/pipeline/settings';
import { DEFAULT_NAVIGATION_PARAMS } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { mixSeed } from '@/engine/core/rng';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';
import { ghostSpecs } from '@/features/lab/session/ghostSelection';
import { modelRunners, type SandboxBrain } from './sandboxModel';
import { MAX_RUNNERS, type FieldEntry, type NavSandbox, type SandboxCourse, type SandboxLineup } from '../state/sandboxState';

/** The course a Sandbox pick stands for. A saved course that is gone falls back to level 1. */
export function sandboxCourseSpec(pick: SandboxCourse, saved: readonly CourseSpec[]): CourseSpec {
  if (pick.kind === 'named') return namedCourse(pick.id) ?? generateCourse(1, pick.id.length);
  if (pick.kind === 'saved') return saved.find((c) => c.id === pick.id) ?? generateCourse(1, 1);
  return generateCourse(pick.level, mixSeed(pick.seed, pick.level, 0x5a));
}

/** What the replay worker gets: the setup, one ghost per runner, and each runner's generation in stream order. */
export interface SandboxScene {
  setup: NavigationSetup;
  specs: GhostSpec[];
  generations: number[];
  /** The brains' inputs, when they differ from the run's. */
  inputs: NavigationInputConfig | null;
  /** A shipped model on screen, as the inputs and network panels show it. Null for the run's own champions. */
  brain: SandboxBrain | null;
}

/**
 * The run's champions as runners. Champions go oldest first, the order
 * the ghost colors ramp in, while the grid fills newest first so the
 * newest takes the front row. A champion's copies stand side by side and
 * each gets its own seed, so their noise and script rand() differ.
 */
function fieldRunners(run: RunConfig, records: GenerationRecord[], field: readonly FieldEntry[]): GhostSpec[] {
  const asked = [...field].sort((a, b) => a.generation - b.generation);
  const base = new Map(ghostSpecs(run, records, asked.map((r) => r.generation)).map((s) => [s.generation, s]));
  const rows = asked.filter((r) => base.has(r.generation));
  const first = new Map<number, number>();
  let taken = 0;
  for (const row of [...rows].reverse()) {
    first.set(row.generation, taken);
    taken += row.copies;
  }
  return rows.flatMap((row) => Array.from({ length: row.copies }, (_, k) => ({ ...base.get(row.generation)!, seed: base.get(row.generation)!.seed + k * 7919, slot: first.get(row.generation)! + k })));
}

/**
 * The scene for the Sandbox as set up now: the picked course, the runners
 * from the run or a shipped model, and any lesioned inputs. Null when
 * there is nothing to play yet.
 */
export function sandboxScene(run: RunConfig, records: GenerationRecord[], s: NavSandbox, lesions: Record<number, number>): SandboxScene | null {
  const spec = sandboxCourseSpec(s.course, s.saved);
  const lesion = Object.entries(lesions).map(([k, v]) => [Number(k), v] as [number, number]);
  const own = navigationOf(run);
  let specs: GhostSpec[];
  let inputs: NavigationInputConfig | null = null;
  let brain: SandboxBrain | null = null;
  if (s.source === 'model') {
    const model = s.models?.find((m) => m.tier === s.model) ?? s.models?.[0];
    const runners = model ? modelRunners(model, Math.min(MAX_RUNNERS, s.modelCopies)) : null;
    if (!runners) return null;
    specs = runners.specs;
    inputs = runners.inputs;
    brain = runners.brain;
  } else specs = fieldRunners(run, records, s.field).filter((r) => (r.slot ?? 0) < MAX_RUNNERS);
  if (!specs.length) return null;
  const setup: NavigationSetup = {
    scriptSource: null,
    courses: [spec],
    level: spec.level,
    params: s.source === 'model' ? DEFAULT_NAVIGATION_PARAMS : own.settings.params,
    inputs: inputs ?? own.inputs,
    ...(lesion.length && { lesion }),
  };
  return { setup, specs, generations: specs.map((r) => r.generation), inputs, brain };
}

/** The lineup a scene puts on screen, or the bare course when nobody is lined up. */
export function sandboxLineup(run: RunConfig, s: NavSandbox, scene: SandboxScene | null): SandboxLineup {
  const spec = scene?.setup.courses[0] ?? sandboxCourseSpec(s.course, s.saved);
  const own = navigationOf(run);
  return {
    spec,
    key: JSON.stringify(spec),
    params: scene?.setup.params ?? own.settings.params,
    inputs: scene?.setup.inputs ?? own.inputs,
    seeds: scene?.specs.map((g) => g.seed) ?? [],
    slots: scene?.specs.map((g) => g.slot ?? 0) ?? [],
  };
}
