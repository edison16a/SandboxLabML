import { CourseCache } from '@/engine/navigation/pipeline/courseCache';
import { navigationOf } from '@/engine/navigation/pipeline/settings';
import type { NavigationParams } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import type { NavFeed } from '@/render/navigation/types';
import { viewportHeld } from '@/features/lab/state/labState';
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
 *
 * The Sandbox shows only its own scene: the replay once it streams the
 * Sandbox course, and until then that course with the runners on their
 * spots. Training's course and population never show there.
 */
export class LabFeeds {
  readonly population: StreamFeed;
  readonly ghosts: StreamFeed;
  private readonly idle: IdleFeed;
  /** The Sandbox course with its runners standing, while the replay of it starts. */
  private readonly lineup: IdleFeed;
  private run: NavigationLabState['run'] = null;
  private parts: ReturnType<typeof navigationOf> | null = null;

  constructor(
    streams: { population: SnapshotStream; ghosts: SnapshotStream },
    private readonly state: () => NavigationLabState,
  ) {
    const courses = new CourseCache();
    this.population = new StreamFeed(streams.population, courses);
    this.ghosts = new StreamFeed(streams.ghosts, courses);
    this.idle = new IdleFeed(courses);
    this.lineup = new IdleFeed(courses);
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
    if (s.mode === 'sandbox') return this.sandboxFeed(s);
    if (this.showsPopulation(s)) return this.population;
    // Between two watched generations the next one lines up, so the view never flicks over to the ghosts.
    const between = s.mode === 'train' && s.view !== 'overlay' && s.status === 'running' && isWatchSpeed(s.speed);
    if (!between && this.showsGhosts(s)) return null;
    // Nothing streams: the room the next generation runs, with the population on the grid unless only ghosts are wanted.
    this.idle.sync(s.run, s.content, s.view !== 'overlay');
    this.idle.leaderless = s.status !== 'running';
    return this.idle;
  };

  readonly getGhosts = (): NavFeed | null => {
    const s = this.state();
    return s.run && s.mode === 'train' && this.showsGhosts(s) ? this.ghosts : null;
  };

  /**
   * The Sandbox view. Its replayed runners are the field on screen, drawn
   * like a population with its champion, not as ghosts. Frames of another
   * course (an older scene, or training's ghosts) never show: until the
   * replay streams this one, the runners stand on their start spots.
   */
  private sandboxFeed(s: NavigationLabState): NavFeed | null {
    const lineup = s.sandbox.lineup;
    const started = lineup !== null && this.ghosts.specKey === lineup.key;
    if (started && this.ghosts.hasFrame) return this.ghosts;
    this.lineup.syncLineup(lineup);
    this.lineup.follow = this.ghosts.follow;
    // Waiting for the first frame of a replay that has started, they share its episode, so the hand over is seamless.
    // Before it starts they are an episode of their own, so the camera glides to them.
    this.lineup.epoch = this.ghosts.epoch + (started ? 0 : 0.5);
    return this.lineup;
  }

  /** True when the Sandbox view shows the replay itself, not its runners standing. */
  private sandboxReplays(s: NavigationLabState): boolean {
    const lineup = s.sandbox.lineup;
    return lineup !== null && this.ghosts.specKey === lineup.key && this.ghosts.hasFrame;
  }

  /**
   * The runners the HUD counts: the latest frame of the feed on screen, or
   * null when no runners are on screen. Read from the stream itself, which
   * holds its latest buffer until the next frame (the renderer's copy may
   * already be handed back).
   */
  counted(s: NavigationLabState): { buffer: Float32Array; count: number } | null {
    if (!s.run || s.run.env !== 'navigation') return null;
    // The HUD ticks on its own clock, so it catches the feeds up first rather than trust what the last drawn frame saw.
    this.sync(s);
    if (s.mode === 'sandbox') {
      if (this.sandboxReplays(s)) return this.frameOf(this.ghosts);
      this.lineup.syncLineup(s.sandbox.lineup);
      return this.lineup.curr && this.lineup.count > 0 ? { buffer: this.lineup.curr, count: this.lineup.count } : null;
    }
    return this.showsPopulation(s) ? this.frameOf(this.population) : null;
  }

  private frameOf(feed: StreamFeed): { buffer: Float32Array; count: number } | null {
    const buffer = feed.stream.curr?.buffer;
    return buffer && buffer.length > 0 ? { buffer, count: feed.stream.count } : null;
  }

  /**
   * The level on screen: the Sandbox course's in the Sandbox, the streamed
   * course's while one streams, else the content's. Max holds the replay
   * still while it trains, so its level would go stale while training
   * climbs: then it reads training's own, as Driving does.
   */
  level(s: NavigationLabState): number {
    if (!s.run || s.run.env !== 'navigation') return 0;
    this.sync(s);
    if (s.mode === 'sandbox') return s.sandbox.lineup?.spec.level ?? 0;
    if (viewportHeld(s)) return s.content?.curriculum.level ?? this.population.level;
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
    // The run's rules and sensors are read once per run, so a frame allocates nothing.
    if (s.run !== this.run) {
      this.run = s.run;
      this.parts = navigationOf(s.run!);
    }
    const { settings, inputs } = this.parts!;
    const scale = s.mode === 'train' && isWatchSpeed(s.speed) ? WATCH_SPEEDS[s.speed] : 1;
    syncFeed(this.population, settings.params, inputs, scale);
    // A shipped model in the Sandbox has inputs of its own, which the sensor drawing must read.
    syncFeed(this.ghosts, settings.params, (s.mode === 'sandbox' && s.sandbox.inputs) || inputs, scale);
    const runner = s.focus.kind === 'agent' ? s.focus.index : null;
    this.ghosts.follow = s.mode === 'sandbox' ? runner : s.focus.kind === 'ghost' && this.ghosts.tags ? indexOrNull(this.ghosts.tags.indexOf(s.focus.generation)) : null;
    this.population.follow = runner;
  }
}

const indexOrNull = (i: number) => (i >= 0 ? i : null);

function syncFeed(feed: StreamFeed, params: NavigationParams, inputs: NavigationInputConfig, scale: number): void {
  feed.sync(params);
  feed.inputs = inputs;
  feed.timeScale = scale;
}
