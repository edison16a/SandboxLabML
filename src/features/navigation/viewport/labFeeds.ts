import { CourseCache } from '@/engine/navigation/pipeline/courseCache';
import { navigationOf } from '@/engine/navigation/pipeline/settings';
import type { NavigationParams } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import type { NavFeed } from '@/render/navigation/types';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import type { NavigationLabState } from '../state/labStore';
import { IdleFeed } from './idleFeed';
import { StreamFeed } from './streamFeed';

/**
 * Decides, every frame, what the Navigation viewport shows. The live
 * population while it streams (or stands paused mid run); else the ghost
 * replay, which then is the followed feed; else the next generation's
 * course with the population lined up. The view toggle hides one or the
 * other. A replay on the population's course rides along as ghosts.
 */
export class LabFeeds {
  readonly population: StreamFeed;
  readonly ghosts: StreamFeed;
  private readonly idle: IdleFeed;

  constructor(
    streams: { population: SnapshotStream; ghosts: SnapshotStream },
    private readonly state: () => NavigationLabState,
  ) {
    const courses = new CourseCache();
    this.population = new StreamFeed(streams.population, courses);
    this.ghosts = new StreamFeed(streams.ghosts, courses);
    this.idle = new IdleFeed(courses);
  }

  /** Lets go of the streams, when the lab unmounts. */
  dispose(): void {
    this.population.dispose();
    this.ghosts.dispose();
  }

  /** The population feed, the idle course when nothing streams, or null when the ghosts take the view. */
  readonly getFeed = (): NavFeed | null => {
    const s = this.state();
    if (!s.run || s.run.env !== 'navigation') return null;
    this.sync(s);
    if (this.showsPopulation(s)) return this.population;
    if (this.showsGhosts(s)) return null;
    // Nothing streams: the room the next generation runs, with the population on the grid unless only ghosts are wanted.
    this.idle.sync(s.run, s.content, s.view !== 'overlay');
    return this.idle;
  };

  readonly getGhosts = (): NavFeed | null => {
    const s = this.state();
    return s.run && this.showsGhosts(s) ? this.ghosts : null;
  };

  /** The level on screen: the streamed course's while one streams, else the content's. */
  level(s: NavigationLabState): number {
    if (this.showsPopulation(s)) return this.population.level;
    if (this.showsGhosts(s)) return this.ghosts.level;
    return s.content?.curriculum.level ?? 0;
  }

  /** True when the live population is what the view follows. */
  showsPopulation(s: NavigationLabState): boolean {
    const pop = this.population;
    if (s.mode !== 'train' || s.view === 'overlay' || !pop.hasFrame) return false;
    if (s.status === 'running' && isWatchSpeed(s.speed)) return true;
    // Paused mid run it stays; once its episode is over (as under Turbo, which trains unseen), the replay is the better view.
    return !pop.ended && pop.anyRunning;
  }

  private showsGhosts(s: NavigationLabState): boolean {
    return (s.mode === 'sandbox' || s.view !== 'population') && this.ghosts.hasFrame;
  }

  private sync(s: NavigationLabState): void {
    const { settings, inputs } = navigationOf(s.run!);
    const scale = s.mode === 'train' && isWatchSpeed(s.speed) ? WATCH_SPEEDS[s.speed] : 1;
    syncFeed(this.population, settings.params, inputs, scale);
    syncFeed(this.ghosts, settings.params, inputs, scale);
    this.ghosts.follow = s.focus.kind === 'ghost' && this.ghosts.tags ? indexOrNull(this.ghosts.tags.indexOf(s.focus.generation)) : null;
    this.population.follow = s.focus.kind === 'car' ? s.focus.index : null;
  }
}

const indexOrNull = (i: number) => (i >= 0 ? i : null);

function syncFeed(feed: StreamFeed, params: NavigationParams, inputs: NavigationInputConfig, scale: number): void {
  feed.sync(params);
  feed.inputs = inputs;
  feed.timeScale = scale;
}
