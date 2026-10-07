import { findPresetBlueprint } from '../blueprints/presets';
import { ENGINE_VERSION } from '../core/version';
import { base64ToBytes, decodeGenome } from '../neat/serialize';
import type { Genome } from '../neat/types';
import { CAR_PRESETS, type CarPresetId } from '../racing/car/params';
import { racingInputSchema } from '../racing/sensors/inputSchema';
import { findTrack } from '../racing/track/presets';
import type { RacingSetup } from '../training/racingSetup';

/** Bumped when the file layout changes, so an old file is ignored instead of misread. */
export const HERO_RACER_VERSION = 1;

/** Where the landing page fetches the hero car from, under public/. */
export const HERO_RACER_PATH = '/hero/racer.json';

/**
 * The trained car the landing page shows driving. It is a real champion
 * from scripts/train-hero-racer.ts: the brain, the track and the car it
 * learned on, and the seed its laps replay with.
 */
export interface HeroRacerFile {
  version: number;
  engineVersion: number;
  track: string;
  carPreset: CarPresetId;
  blueprint: string;
  /** Training seed and the generation the champion comes from. */
  seed: number;
  generation: number;
  /** Per car seed it trained with, so the replay draws the same numbers. */
  replaySeed: number;
  /** Best lap in the endless check, s. Shown on the page as a fact about this car. */
  lapTime: number;
  genome: string;
}

/** A hero file checked and decoded, ready to hand to the replay worker. */
export interface HeroRacer {
  file: HeroRacerFile;
  genome: Genome;
  setup: RacingSetup;
}

/**
 * The hero lap never ends on the clock: an hour is far past anything a
 * visitor watches, and a crash or stall still stops it like in training.
 */
export const HERO_MAX_TIME = 3600;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Checks a fetched hero file and builds what the replay needs from it. The
 * file can be stale after an engine change, and then the page keeps its
 * poster rather than showing a car that drives wrong, so anything
 * unexpected becomes null.
 */
export function parseHeroRacer(data: unknown): HeroRacer | null {
  if (!isObj(data) || data.version !== HERO_RACER_VERSION || data.engineVersion !== ENGINE_VERSION) return null;
  const { track, carPreset, blueprint, genome } = data;
  if (typeof track !== 'string' || typeof blueprint !== 'string' || typeof genome !== 'string') return null;
  if (!isNum(data.seed) || !isNum(data.generation) || !isNum(data.replaySeed) || !isNum(data.lapTime)) return null;
  const spec = findTrack(track);
  const car = CAR_PRESETS[carPreset as CarPresetId];
  const bp = findPresetBlueprint(blueprint);
  if (!spec || !car || bp?.env !== 'racing') return null;
  try {
    const decoded = decodeGenome(base64ToBytes(genome));
    if (decoded.outputs.length !== 2 || decoded.inputs.length !== racingInputSchema(bp.inputs, car).length) return null;
    return {
      file: data as unknown as HeroRacerFile,
      genome: decoded,
      setup: { track: spec, car, inputs: bp.inputs, maxTime: HERO_MAX_TIME, scriptSource: null },
    };
  } catch {
    return null;
  }
}
