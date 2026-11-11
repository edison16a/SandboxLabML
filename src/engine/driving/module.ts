import type { EpisodeEnvModule } from '../env/episode';
import type { ChampionRecord } from '../training/records';
import { drivingInfo } from './info';
import { drivingContentHash, initialDrivingContent, nextDrivingContent, type DrivingContent } from './run/content';
import { drivingChampionFields, drivingGenerationMetrics } from './run/metrics';
import type { DrivingRunResult } from './run/results';
import { createDrivingRunSetup, type DrivingRunSetup } from './run/setup';
import { DrivingTrips } from './run/trips';

/**
 * Driving as an episode env. The content is the city, the level, the trip
 * count and a trip seed that moves on every generation, so brains learn to
 * drive rather than one route. The automatic curriculum and a script's
 * generation block move the level (see run/content.ts). Every record keeps
 * the content it ran on, so a champion can be replayed on its own trips.
 */
export const drivingModule: EpisodeEnvModule<DrivingRunSetup, DrivingContent, DrivingRunResult, ChampionRecord> = {
  ...drivingInfo,

  initialContent: initialDrivingContent,
  nextContent: nextDrivingContent,
  contentHash: drivingContentHash,
  contentOnRecords: true,
  createSetup: createDrivingRunSetup,
  createEnv: (setup, host, seed) => new DrivingTrips(setup, host, seed),

  championFields: drivingChampionFields,
  generationMetrics: drivingGenerationMetrics,
};
