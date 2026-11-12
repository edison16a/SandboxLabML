import { buildCourse, type Course } from '../../navigation/course/build';
import type { CourseSpec } from '../../navigation/course/types';
import { DEFAULT_NAVIGATION_PARAMS, NAVIGATION_ENGINE_VERSION } from '../../navigation/params';
import type { NavigationInputConfig } from '../../navigation/sensors/inputConfig';
import { navigationInputSchema } from '../../navigation/sensors/inputSchema';
import { base64ToBytes, decodeGenome } from '../../neat/serialize';
import type { Genome } from '../../neat/types';
import { isNum, isObj } from '../parse';

/** Bumped when the file layout changes, so an old file is ignored instead of misread. */
export const HERO_NAVIGATOR_VERSION = 1;

/** Where the landing page fetches the hero runner from, under public/. */
export const HERO_NAVIGATOR_PATH = '/hero/navigator.json';

/** One course of the loop: the room, the runner's spot on the start grid and its seed (its small offset off that spot). */
export interface HeroCourseRun {
  spec: CourseSpec;
  slot: number;
  seed: number;
}

/**
 * The runner the landing page shows, written by
 * scripts/train-hero-navigator.ts: one trained brain and the courses it
 * crosses in a loop. Every course in the file was checked to end at the
 * finish line.
 */
export interface HeroNavigatorFile {
  version: number;
  engineVersion: number;
  /** The preset brain it trained as, such as navigation-starter. */
  blueprint: string;
  inputs: NavigationInputConfig;
  courses: HeroCourseRun[];
  /** Ticks into the first course the page opens on (the poster's moment), when not the default. */
  opening?: number;
  /** Where the brain comes from, in plain words. */
  source: string;
  genome: string;
}

/** A hero runner file checked and decoded, with its courses built. */
export interface HeroNavigator {
  file: HeroNavigatorFile;
  genome: Genome;
  courses: Course[];
}

/** Checks the parts of an input config the env reads. */
function isInputs(v: unknown): v is NavigationInputConfig {
  return isObj(v) && isObj(v.rays) && isNum(v.rays.count) && isNum(v.rays.fov) && isNum(v.noise);
}

function isRun(v: unknown): v is HeroCourseRun {
  return isObj(v) && isNum(v.slot) && isNum(v.seed) && isObj(v.spec) && typeof v.spec.id === 'string' && typeof v.spec.name === 'string' && isNum(v.spec.length) && isNum(v.spec.width) && Array.isArray(v.spec.obstacles);
}

/**
 * Checks a fetched hero runner file and builds its courses. A stale or
 * broken file becomes null, and the page keeps its poster.
 */
export function parseHeroNavigator(data: unknown): HeroNavigator | null {
  if (!isObj(data) || data.version !== HERO_NAVIGATOR_VERSION || data.engineVersion !== NAVIGATION_ENGINE_VERSION) return null;
  const { blueprint, genome, courses, source, inputs } = data;
  if (typeof blueprint !== 'string' || typeof genome !== 'string' || typeof source !== 'string' || !isInputs(inputs)) return null;
  if (!Array.isArray(courses) || courses.length === 0 || !courses.every(isRun)) return null;
  if (data.opening !== undefined && (!isNum(data.opening) || data.opening < 1)) return null;
  try {
    const decoded = decodeGenome(base64ToBytes(genome));
    if (decoded.outputs.length !== 2 || decoded.inputs.length !== navigationInputSchema(inputs).length) return null;
    const built = courses.map((c) => buildCourse(c.spec, DEFAULT_NAVIGATION_PARAMS));
    return { file: data as unknown as HeroNavigatorFile, genome: decoded, courses: built };
  } catch {
    return null;
  }
}
