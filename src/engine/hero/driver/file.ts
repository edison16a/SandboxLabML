import { builtInCity } from '../../driving/city/presets';
import { drivingLevel } from '../../driving/levels';
import { SUV } from '../../driving/car/params';
import type { DrivingInputConfig } from '../../driving/sensors/inputConfig';
import { drivingInputSchema } from '../../driving/sensors/inputSchema';
import { createDrivingSetup, type DrivingSetup } from '../../driving/setup';
import { DRIVING_ENGINE_VERSION } from '../../driving/version';
import { base64ToBytes, decodeGenome } from '../../neat/serialize';
import type { Genome } from '../../neat/types';
import { isNum, isObj } from '../parse';

/** Bumped when the file layout changes, so an old file is ignored instead of misread. */
export const HERO_DRIVER_VERSION = 1;

/** Where the landing page fetches the hero driver from, under public/. */
export const HERO_DRIVER_PATH = '/hero/driver.json';

/**
 * The SUV the landing page shows driving, written by
 * scripts/train-hero-driver.ts: one trained brain and the trips it drives
 * in a loop. Each trip is a seed for createDrivingSetup in one city at one
 * level, so the route, the lights, the people and the traffic replay the
 * same way every time, and every trip in the file was checked to end with
 * a clean arrival.
 */
export interface HeroDriverFile {
  version: number;
  engineVersion: number;
  /** A built in city id. */
  city: string;
  level: number;
  /** The preset brain it trained as, such as driving-standard. */
  blueprint: string;
  inputs: DrivingInputConfig;
  /** The brain's own seed (sensor noise), as the trips were checked with. */
  brainSeed: number;
  /** Trip seeds in loop order. */
  trips: number[];
  /** Ticks into the first trip the page opens on (the poster's moment), when not the default. */
  opening?: number;
  /** Where the brain comes from, in plain words, for anyone reading the file. */
  source: string;
  /** The genome in the binary format, as base64. */
  genome: string;
}

/** A hero driver file checked and decoded, with its trips built. */
export interface HeroDriver {
  file: HeroDriverFile;
  genome: Genome;
  trips: DrivingSetup[];
}

/** The setup of one hero trip: the same seed always gives the same trip. */
export function heroTrip(city: string, level: number, seed: number): DrivingSetup | null {
  const spec = builtInCity(city);
  return spec ? createDrivingSetup({ city: spec, level: drivingLevel(level).id, seed }) : null;
}

/** Checks the parts of an input config the env reads. */
function isInputs(v: unknown): v is DrivingInputConfig {
  return isObj(v) && isObj(v.lidar) && isNum(v.lidar.count) && isNum(v.lidar.range) && isNum(v.lidar.fov) && isNum(v.noise);
}

/**
 * Checks a fetched hero driver file and builds its trips. The file goes
 * stale when the Driving engine changes, and then the page keeps its
 * poster rather than show a drive that would go differently, so anything
 * unexpected becomes null.
 */
export function parseHeroDriver(data: unknown): HeroDriver | null {
  if (!isObj(data) || data.version !== HERO_DRIVER_VERSION || data.engineVersion !== DRIVING_ENGINE_VERSION) return null;
  const { city, blueprint, genome, trips, source } = data;
  if (typeof city !== 'string' || typeof blueprint !== 'string' || typeof genome !== 'string' || typeof source !== 'string') return null;
  if (!isNum(data.level) || !isNum(data.brainSeed) || !isInputs(data.inputs) || !Array.isArray(trips) || trips.length === 0 || !trips.every(isNum)) return null;
  if (data.opening !== undefined && (!isNum(data.opening) || data.opening < 1)) return null;
  const built = trips.map((seed) => heroTrip(city, data.level as number, seed));
  if (built.some((t) => t === null)) return null;
  try {
    const decoded = decodeGenome(base64ToBytes(genome));
    if (decoded.outputs.length !== 2 || decoded.inputs.length !== drivingInputSchema(data.inputs, SUV).length) return null;
    return { file: data as unknown as HeroDriverFile, genome: decoded, trips: built as DrivingSetup[] };
  } catch {
    return null;
  }
}
