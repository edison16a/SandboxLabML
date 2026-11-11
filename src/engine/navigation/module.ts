import type { EpisodeEnvModule } from '../env/episode';
import type { ChampionRecord } from '../training/records';
import { formationSlots } from './course/formation';
import { navigationInfo } from './info';
import { initialNavigationContent, navigationContentHash, nextNavigationContent, type NavigationContent } from './pipeline/content';
import { navigationChampionMetrics, navigationGenerationMetrics } from './pipeline/metrics';
import type { NavigationRunResult } from './pipeline/runResult';
import { createCourseSet, navigationSetupFor, type NavigationSetup } from './pipeline/setup';

/**
 * Navigation as an episode env. The content is a level, a curriculum and
 * the generation's course seeds, so it changes every generation and every
 * record keeps it. A generation is a CourseSetEnv: each brain runs each
 * of the generation's courses, from a start slot of its own.
 */
export const navigationModule: EpisodeEnvModule<NavigationSetup, NavigationContent, NavigationRunResult, ChampionRecord> = {
  ...navigationInfo,

  initialContent: initialNavigationContent,
  nextContent: nextNavigationContent,
  contentHash: navigationContentHash,
  contentOnRecords: true,
  createSetup: navigationSetupFor,
  createEnv: createCourseSet,
  startSlots: formationSlots,

  championFields: (r) => ({ metrics: navigationChampionMetrics(r) }),
  generationMetrics: navigationGenerationMetrics,
};
