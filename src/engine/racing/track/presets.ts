import { circle, stadium } from './shapes';
import type { TrackSpec, Vec2 } from './types';

function scale(points: Vec2[], k: number): Vec2[] {
  return points.map(([x, y]) => [Math.round(x * k * 10) / 10, Math.round(y * k * 10) / 10]);
}

/**
 * Built-in tracks, easiest first. Every corner has a centerline radius of at
 * least 12 m, the tightest the car model can take at walking pace with
 * room to spare; a unit test checks this.
 */
export const BUILT_IN_TRACKS: readonly TrackSpec[] = [
  {
    id: 'oval',
    name: 'Oval',
    width: 10,
    points: stadium(120, 35),
  },
  {
    id: 'sprint',
    name: 'Sprint',
    width: 9,
    points: scale(
      [[0, 0], [80, 0], [130, 15], [155, 55], [140, 95], [95, 110], [60, 90], [30, 105], [-15, 100], [-40, 65], [-35, 25]],
      1.1,
    ),
  },
  {
    id: 'hairpin',
    name: 'Hairpin',
    width: 9,
    points: [[0, 0], [90, 0], [170, 0], [195, 6], [207, 22], [200, 40], [180, 47], [120, 42], [70, 55], [30, 58], [-10, 52], [-30, 30], [-25, 10]],
  },
  {
    id: 'esses',
    name: 'Esses',
    width: 9,
    points: scale(
      [[0, 0], [60, 0], [95, 15], [110, 45], [95, 70], [110, 95], [150, 100], [175, 125], [160, 160], [115, 165], [80, 145], [50, 160], [10, 155], [-20, 130], [-15, 95], [-35, 65], [-30, 25]],
      1.3,
    ),
  },
  {
    id: 'grand-prix',
    name: 'Grand Prix',
    width: 10,
    points: scale(
      [[0, 0], [140, 0], [190, 10], [215, 40], [205, 75], [170, 85], [140, 70], [110, 85], [105, 125], [135, 150], [180, 160], [200, 195], [175, 230], [110, 235], [40, 225], [-10, 200], [-30, 160], [-10, 120], [-40, 90], [-55, 50], [-40, 15]],
      1.25,
    ),
  },
];

/** A plain ring, used by tests and as the empty canvas for the editor. */
export const RING_TRACK: TrackSpec = { id: 'ring', name: 'Ring', width: 10, points: circle(50, 16) };

export function findTrack(id: string): TrackSpec | undefined {
  return BUILT_IN_TRACKS.find((t) => t.id === id);
}
