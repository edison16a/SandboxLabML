import { describe, expect, it } from 'vitest';
import { generateCourse } from '@/engine/navigation/course/generate';
import { NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_BLUEPRINTS } from '@/engine/navigation/pipeline/blueprints';
import { initialNavigationContent } from '@/engine/navigation/pipeline/content';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { NAVIGATION_SNAPSHOT, navigationWorldSize, SNAP_STATUS } from '@/engine/navigation/snapshot';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { labDefaults } from '@/features/lab/state/labState';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import type { StreamOut } from '@/workers/shared/protocol';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { sandboxLineup, sandboxScene } from '../session/sandboxScene';
import type { NavigationLabState } from '../state/labStore';
import { SANDBOX_DEFAULTS, type NavSandbox } from '../state/sandboxState';
import { LabFeeds } from './labFeeds';

const run = createEpisodeRunConfig({ env: 'navigation', name: 't', seed: 3, blueprint: NAVIGATION_BLUEPRINTS[1], populationSize: 20, settings: { ...navigationSettings() } });
const spec = generateCourse(0, 9);

/** A stand in for a snapshot stream: the fields the feeds read, and a way to play messages into it. */
function fakeStream() {
  const listeners = new Set<(m: StreamOut) => void>();
  const s = {
    curr: null as { buffer: Float32Array } | null,
    prev: null as { buffer: Float32Array } | null,
    count: 0,
    generation: 0,
    tags: new Int32Array(0),
    world: 0,
    inspect: null,
    scene: null as unknown,
    epoch: 0,
    alpha: () => 1,
    on: (fn: (m: StreamOut) => void) => (listeners.add(fn), () => listeners.delete(fn)),
    start(count: number, shown: CourseSpec = spec) {
      s.count = count;
      s.scene = { spec: shown, index: 0, of: 1, level: shown.level };
      s.epoch++;
      s.curr = s.prev = null;
      for (const fn of listeners) fn({ kind: 'start', stream: 'population', generation: 0, count });
    },
    frame(status: number) {
      const buffer = new Float32Array(s.count * NAVIGATION_SNAPSHOT.stride + navigationWorldSize());
      for (let i = 0; i < s.count; i++) buffer[i * NAVIGATION_SNAPSHOT.stride + SNAP_STATUS] = status;
      s.prev = s.curr;
      s.curr = { buffer };
    },
    end() {
      for (const fn of listeners) fn({ kind: 'end', stream: 'population', generation: 0 });
    },
  };
  return s;
}

function lab(patch: Partial<NavigationLabState> = {}): NavigationLabState {
  return { ...labDefaults('follow'), camera: 'follow', content: initialNavigationContent(run), followed: -1, set: () => {}, run, ...patch } as NavigationLabState;
}

function setup(state: NavigationLabState) {
  const population = fakeStream();
  const ghosts = fakeStream();
  const feeds = new LabFeeds({ population: population as unknown as SnapshotStream, ghosts: ghosts as unknown as SnapshotStream }, () => state);
  return { population, ghosts, feeds };
}

describe('what the Navigation viewport shows', () => {
  it('shows the next course with the population on its grid before anything streams', () => {
    const { feeds } = setup(lab());
    const feed = feeds.getFeed();
    expect(feed?.course).not.toBeNull();
    expect(feed?.count).toBe(20);
    expect(feeds.getGhosts()).toBeNull();
  });

  it('follows the live population while it runs at a watch speed', () => {
    const state = lab({ status: 'running', speed: '1x' });
    const { population, feeds } = setup(state);
    population.start(20);
    population.frame(NAV_RUNNING);
    expect(feeds.getFeed()).toBe(feeds.population);
  });

  it('keeps a paused run on screen, and hands an ended one to the replay under Turbo', () => {
    const state = lab({ status: 'paused', speed: '1x' });
    const { population, ghosts, feeds } = setup(state);
    population.start(20);
    population.frame(NAV_RUNNING);
    ghosts.start(3);
    ghosts.frame(NAV_RUNNING);
    expect(feeds.getFeed()).toBe(feeds.population);
    population.frame(NAV_FINISHED);
    population.end();
    Object.assign(state, { status: 'running', speed: 'turbo' });
    expect(feeds.getFeed()).toBeNull();
    expect(feeds.getGhosts()).toBe(feeds.ghosts);
  });

  it('shows the whole course while idle, and lines the next generation up between watched ones', () => {
    const state = lab();
    const { population, ghosts, feeds } = setup(state);
    expect(feeds.getFeed()?.leaderless).toBe(true);
    ghosts.start(3);
    ghosts.frame(NAV_RUNNING);
    Object.assign(state, { status: 'running', speed: '2x' });
    population.start(20);
    const between = feeds.getFeed();
    expect(between).not.toBe(feeds.population);
    expect(between?.count).toBe(20);
    expect(between?.leaderless).toBe(false);
    population.frame(NAV_RUNNING);
    expect(feeds.getFeed()).toBe(feeds.population);
  });

  it('shows ghosts only in the overlay view, and the bare room when there are none yet', () => {
    const state = lab({ view: 'overlay', status: 'running', speed: '1x' });
    const { population, ghosts, feeds } = setup(state);
    population.start(20);
    population.frame(NAV_RUNNING);
    const bare = feeds.getFeed();
    expect(bare).not.toBe(feeds.population);
    expect(bare?.count).toBe(0);
    ghosts.start(2);
    ghosts.frame(NAV_RUNNING);
    expect(feeds.getFeed()).toBeNull();
    expect(feeds.getGhosts()).toBe(feeds.ghosts);
  });

  describe('in the Sandbox', () => {
    // Two copies of the run's champion on a level 1 course, while training is on a level 0 course.
    const records = [{ generation: 0, genome: { nodes: [], connections: [] }, replaySeed: 4, replaySlot: 0, champion: { fitness: 1 } }] as never;
    const picked: NavSandbox = { ...SANDBOX_DEFAULTS, course: { kind: 'level', level: 1, seed: 7 }, field: [{ generation: 0, copies: 2 }] };
    const scene = sandboxScene(run, records, picked, {})!;
    const sandbox: NavSandbox = { ...picked, lineup: sandboxLineup(run, picked, scene) };
    const course = sandbox.lineup!.spec;

    it('never shows the training course, the population or their shares while the replay has no frame', () => {
      const state = lab({ mode: 'sandbox', sandbox, status: 'paused' });
      const { population, ghosts, feeds } = setup(state);
      // Training's last frame and an older replay on the training course are both still in their streams.
      population.start(20);
      population.frame(NAV_RUNNING);
      ghosts.start(3);
      ghosts.frame(NAV_RUNNING);
      for (let k = 0; k < 3; k++) {
        const feed = feeds.getFeed();
        expect(feed?.course?.spec).toEqual(course);
        expect(feed?.count).toBe(2);
        expect(feed).not.toBe(feeds.ghosts);
        expect(feed).not.toBe(feeds.population);
        expect(feeds.counted(state)?.count).toBe(2);
        expect(feeds.level(state)).toBe(1);
        expect(feeds.getGhosts()).toBeNull();
      }
    });

    it('hands over to the replay once it streams the Sandbox course, in the same episode', () => {
      const state = lab({ mode: 'sandbox', sandbox, status: 'paused' });
      const { ghosts, feeds } = setup(state);
      ghosts.start(2, course);
      const standing = feeds.getFeed();
      expect(standing).not.toBe(feeds.ghosts);
      expect(standing?.epoch).toBe(feeds.ghosts.epoch);
      ghosts.frame(NAV_RUNNING);
      expect(feeds.getFeed()).toBe(feeds.ghosts);
      expect(feeds.counted(state)?.count).toBe(2);
      // The loop restarts: the runners stand on their spots for the moment before its first frame,
      // and the HUD counts them even before the viewport draws again.
      ghosts.start(2, course);
      expect(feeds.counted(state)?.count).toBe(2);
      expect(feeds.getFeed()?.count).toBe(2);
      expect(feeds.getFeed()?.course?.spec).toEqual(course);
    });

    it('shows the bare Sandbox course with no runners lined up, and counts nobody', () => {
      const empty: NavSandbox = { ...picked, field: [], lineup: sandboxLineup(run, { ...picked, field: [] }, null) };
      const state = lab({ mode: 'sandbox', sandbox: empty });
      const { feeds } = setup(state);
      const feed = feeds.getFeed();
      expect(feed?.course?.spec).toEqual(course);
      expect(feed?.count).toBe(0);
      expect(feed?.leaderless).toBe(true);
      expect(feeds.counted(state)).toBeNull();
    });
  });
});
