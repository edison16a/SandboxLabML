import { mixSeed } from '../../../src/engine/core/rng';
import { generateCourse } from '../../../src/engine/navigation/course/generate';
import { NAV_LEVELS, TOP_LEVEL } from '../../../src/engine/navigation/course/levels';
import { NAMED_COURSES } from '../../../src/engine/navigation/course/presets';
import type { CourseSpec } from '../../../src/engine/navigation/course/types';
import { navigationModule } from '../../../src/engine/navigation/module';
import { DEFAULT_NAVIGATION_PARAMS } from '../../../src/engine/navigation/params';
import type { NavigationRunResult } from '../../../src/engine/navigation/pipeline/runResult';
import type { NavigationSetup } from '../../../src/engine/navigation/pipeline/setup';
import type { NavigationInputConfig } from '../../../src/engine/navigation/sensors/inputConfig';
import { Network } from '../../../src/engine/neat/network';
import { base64ToBytes, decodeGenome } from '../../../src/engine/neat/serialize';
import { hostFor } from '../../../src/engine/training/scriptHost';

/** The Sandbox's level courses until the user asks for a new layout (SANDBOX_SEED in src/features/navigation/state/sandboxState.ts). */
export const SANDBOX_SEED = 7;
/** Copies of a trained model the Sandbox lines up (STARTING_COPIES in the same file). */
export const MODEL_COPIES = 8;
/** The replay worker's controller seed (GHOST_CONTROLLER_SALT in src/workers/replay/ghostPlayer.ts). */
const REPLAY_CONTROLLER_SEED = mixSeed(0x9405);

/** A course of a level as the Sandbox builds it (sandboxCourseSpec in src/features/navigation/session/sandboxScene.ts). */
const levelCourse = (level: number, seed: number) => generateCourse(level, mixSeed(seed, level, 0x5a));

/** One Sandbox course and how much it counts when models are compared. */
export interface SandboxCourse {
  label: string;
  spec: CourseSpec;
  weight: number;
}

/**
 * The courses a visitor meets in the Sandbox. Every newcomer opens it on
 * level 1, so that course counts the most. A trained run opens on the
 * level its training reached, which is the same layout of that level for
 * everyone. Behind those come a few new layouts and the named courses,
 * which take a click to reach.
 */
export const SANDBOX_COURSES: readonly SandboxCourse[] = [
  { label: 'level 1', spec: levelCourse(1, SANDBOX_SEED), weight: 4 },
  ...NAV_LEVELS.filter((l) => l.level !== 1).map((l) => ({ label: `level ${l.level}`, spec: levelCourse(l.level, SANDBOX_SEED), weight: l.level === 0 ? 0.5 : 1.5 })),
  ...[1, 2, 3].flatMap((k) => NAV_LEVELS.slice(1).map((l) => ({ label: `level ${l.level} layout ${k + 1}`, spec: levelCourse(l.level, SANDBOX_SEED + k), weight: 0.25 }))),
  ...NAMED_COURSES.map((c) => ({ label: c.name, spec: c as CourseSpec, weight: 0.25 })),
];

/** Fresh layouts of levels 1 to 6 that the pick never sees, for the reliability it reports. */
export const CHECK_COURSES: readonly SandboxCourse[] = Array.from({ length: 5 }, (_, k) =>
  NAV_LEVELS.slice(1, TOP_LEVEL + 1).map((l) => ({ label: `level ${l.level}`, spec: levelCourse(l.level, 101 + k), weight: 1 })),
).flat();

/**
 * Share of the runners that cross the line on one course, played the way
 * the Sandbox replays a trained model: MODEL_COPIES copies on the front
 * slots of the start grid, each with its own seed, under the preset's
 * script and the default rules.
 */
export function courseFinishShare(genome: string, inputs: NavigationInputConfig, seed: number, script: string, spec: CourseSpec): number {
  const brain = decodeGenome(base64ToBytes(genome));
  const setup: NavigationSetup = { scriptSource: script, courses: [spec], level: spec.level, params: DEFAULT_NAVIGATION_PARAMS, inputs };
  const env = navigationModule.createEnv(setup, hostFor(script), REPLAY_CONTROLLER_SEED);
  env.reset(
    Array.from({ length: MODEL_COPIES }, () => new Network(brain)),
    Array.from({ length: MODEL_COPIES }, (_, k) => mixSeed(seed, k)),
    Array.from({ length: MODEL_COPIES }, (_, k) => k),
  );
  while (!env.done) env.step();
  let finished = 0;
  for (const r of env.results() as NavigationRunResult[]) finished += r.finished;
  return finished / MODEL_COPIES;
}

/** Finish share on every course of a set, in order. */
export function courseShares(genome: string, inputs: NavigationInputConfig, seed: number, script: string, courses: readonly SandboxCourse[]): number[] {
  return courses.map((c) => courseFinishShare(genome, inputs, seed, script, c.spec));
}

/** The weighted mean of per course shares. */
export function weightedFinish(shares: readonly number[], courses: readonly SandboxCourse[] = SANDBOX_COURSES): number {
  let sum = 0;
  let total = 0;
  courses.forEach((c, i) => {
    sum += (shares[i] ?? 0) * c.weight;
    total += c.weight;
  });
  return total > 0 ? sum / total : 0;
}
