/** One step of the curriculum: what it adds and how long its courses run. */
export interface NavLevel {
  level: number;
  name: string;
  /** One plain sentence for the lab and the lessons. */
  description: string;
  /** Inner length of its courses, m. */
  length: number;
}

/**
 * The curriculum, easiest first. Level 0 is a straight run with nothing in
 * the way; each level after it brings one new kind of obstacle, and the
 * last mixes them all.
 */
export const NAV_LEVELS: readonly NavLevel[] = [
  { level: 0, name: 'Straight run', description: 'An empty room. Run to the line.', length: 26 },
  { level: 1, name: 'One block', description: 'A big crate stands in the way. Go round it.', length: 28 },
  { level: 2, name: 'Block field', description: 'Crates all over the floor. Find a way through.', length: 34 },
  { level: 3, name: 'Spikes', description: 'Rows of spikes. Touch one and the run ends.', length: 36 },
  { level: 4, name: 'Walls and gaps', description: 'Walls across the room with narrow gaps to find.', length: 40 },
  { level: 5, name: 'Movers', description: 'Crates slide across the way. Time the dash.', length: 40 },
  { level: 6, name: 'Gauntlet', description: 'Everything at once.', length: 48 },
];

/** The hardest level. */
export const TOP_LEVEL = NAV_LEVELS.length - 1;
