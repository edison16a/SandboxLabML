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
import type { NavigationLabState } from '../state/labStore';
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
    start(count: number) {
      s.count = count;
      s.scene = { spec, index: 0, of: 1, level: 0 };
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
});
