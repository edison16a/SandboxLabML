import { randomTrackSpec } from '../racing/track/randomTrack';
import type { TrackSpec } from '../racing/track/types';

/**
 * The benchmark's hand-built roads. They are not in BUILT_IN_TRACKS, so no
 * script can pick them with useTrack and no run ever trains on them. Each
 * mixes left and right bends with at least one corner near the 12 m radius
 * limit, and a test proves the scripted driver laps every one of them.
 * Changing a point here changes every score, so bump BENCHMARK_VERSION.
 */
export const BENCH_HAND_BUILT: readonly TrackSpec[] = [
  {
    id: 'bench-harbor',
    name: 'Harbor',
    width: 9,
    points: [[0, 0], [70, 0], [120, 10], [150, 40], [145, 80], [115, 95], [85, 80], [60, 85], [40, 110], [0, 115], [-35, 95], [-45, 55], [-30, 20]],
  },
  {
    id: 'bench-switchback',
    name: 'Switchback',
    width: 9,
    points: [
      [0, 0], [60, -5], [105, 12], [125, 45], [108, 78], [125, 108], [165, 118], [185, 150], [158, 182],
      [105, 178], [65, 155], [22, 168], [-22, 152], [-40, 112], [-25, 76], [-40, 42], [-27, 10],
    ],
  },
  {
    id: 'bench-lakeside',
    name: 'Lakeside',
    width: 10,
    points: [[0, 0], [110, 0], [170, 20], [200, 60], [190, 100], [150, 110], [130, 140], [90, 150], [40, 130], [10, 140], [-30, 120], [-40, 80], [-20, 40]],
  },
];

/**
 * Seeds for the two random roads. Training scripts usually seed random
 * tracks with the generation number at round multiples, so odd seeds in
 * the thousands keep the exam roads away from anything a run trains on.
 */
export const BENCH_RANDOM_SEEDS: readonly number[] = [4101, 4103];

/** Where each episode starts, as a share of the lap. Three starts mean memorizing one opening does not help. */
export const BENCH_STARTS: readonly number[] = [0, 1 / 3, 2 / 3];

/** Length of every exam episode, s. */
export const BENCH_EPISODE_SECONDS = 60;

/** The five exam roads, hand-built first. Random roads get stable ids and friendlier names. */
export function benchTrackSpecs(): TrackSpec[] {
  const random = BENCH_RANDOM_SEEDS.map((seed, i) => ({
    ...randomTrackSpec(seed),
    id: `bench-random-${seed}`,
    name: `Random road ${String.fromCharCode(65 + i)}`,
  }));
  return [...BENCH_HAND_BUILT, ...random];
}
