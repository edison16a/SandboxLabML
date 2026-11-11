import { mixSeed, Rng } from '../../core/rng';
import { DEFAULT_NAVIGATION_PARAMS, type NavigationParams } from '../params';
import { buildCourse, isSolvable } from './build';
import { CourseDraft } from './draft';
import { NAV_LEVELS } from './levels';
import { bigBlock, blockField, moverGate, spikeField, spikeRow, wallWithGaps } from './sections';
import type { CourseSpec } from './types';

/** Width of every generated course, m. */
export const COURSE_WIDTH = 14;
/** Attempts at a solvable course before the generator settles for the empty one. */
const ATTEMPTS = 24;

/** Fills a draft with level `level`'s pieces. Each level adds one new idea to the ones before it. */
function furnish(d: CourseDraft, level: number): void {
  const r = d.rng;
  switch (level) {
    case 0:
      return;
    case 1:
      return bigBlock(d, 0);
    case 2: {
      const [a, b] = [d.bandStart, d.bandEnd];
      return blockField(d, a, b, r.int(3) + 7, 1.1);
    }
    case 3: {
      const zones = d.zones(3);
      for (const [a, b] of zones) spikeRow(d, (a + b) / 2 + r.range(-0.6, 0.6));
      for (const [a, b] of zones) blockField(d, a, b, 1, 1.4);
      return;
    }
    case 4: {
      const zones = d.zones(3);
      zones.forEach(([a, b], i) => wallWithGaps(d, (a + b) / 2 + r.range(-0.8, 0.8), i === 1 && r.chance(0.5) ? 2 : 1));
      for (const [a, b] of zones) blockField(d, a, b, 1, 1.4);
      return;
    }
    case 5: {
      const zones = d.zones(3);
      zones.forEach(([a, b], i) => moverGate(d, (a + b) / 2 + r.range(-0.6, 0.6), i !== 1 || r.chance(0.5)));
      for (const [a, b] of zones) blockField(d, a, b, 1, 1.6);
      return;
    }
    default: {
      // The gauntlet: crates, a spike row, a wall, a mover gate, then spikes round a free mover.
      const zones = d.zones(5);
      const mid = ([a, b]: [number, number]) => (a + b) / 2;
      blockField(d, zones[0][0], zones[0][1], 3, 1.2);
      spikeRow(d, mid(zones[1]));
      wallWithGaps(d, mid(zones[2]), r.chance(0.5) ? 2 : 1);
      moverGate(d, mid(zones[3]), true);
      moverGate(d, mid(zones[4]) - 0.6, false);
      spikeField(d, zones[4][0], zones[4][1], 2);
      blockField(d, zones[2][0], zones[3][1], 2, 1.6);
    }
  }
}

/**
 * A fresh course for a curriculum level, the same for the same seed.
 * Pieces are placed at random with spacing rules, and the result must
 * leave a walkable path from the start pad to the finish with room to
 * spare (see isSolvable); a draft that does not is thrown away and the
 * next sub seed tried.
 */
export function generateCourse(level: number, seed: number, params: NavigationParams = DEFAULT_NAVIGATION_PARAMS): CourseSpec {
  const lv = NAV_LEVELS[Math.max(0, Math.min(NAV_LEVELS.length - 1, Math.floor(level)))];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const d = new CourseDraft(lv.length, COURSE_WIDTH, new Rng(mixSeed(seed, lv.level, attempt)));
    furnish(d, lv.level);
    const spec: CourseSpec = { id: `level-${lv.level}-${seed >>> 0}`, name: lv.name, level: lv.level, length: lv.length, width: COURSE_WIDTH, obstacles: d.obstacles };
    if (isSolvable(buildCourse(spec, params))) return spec;
  }
  return { id: `level-${lv.level}-${seed >>> 0}`, name: lv.name, level: lv.level, length: lv.length, width: COURSE_WIDTH, obstacles: [] };
}
