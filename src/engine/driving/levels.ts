/**
 * Traffic profiles, from empty streets to rush hour. A run's curriculum
 * walks up these; a script's generation block can also pick one.
 */
export interface DrivingLevel {
  id: number;
  name: string;
  /** Signals cycle; when off every head flashes yellow and nobody has to stop. */
  signals: boolean;
  pedestrians: number;
  traffic: number;
  /** Chance per person per minute of crossing mid block, away from any crossing. */
  jaywalk: number;
  /** Chance that a person reaching a crossing on the flashing hand still goes. */
  lateCross: number;
}

export const DRIVING_LEVELS: readonly DrivingLevel[] = [
  { id: 1, name: 'Empty streets', signals: false, pedestrians: 0, traffic: 0, jaywalk: 0, lateCross: 0 },
  { id: 2, name: 'Traffic lights', signals: true, pedestrians: 0, traffic: 0, jaywalk: 0, lateCross: 0 },
  { id: 3, name: 'Pedestrians', signals: true, pedestrians: 60, traffic: 0, jaywalk: 0, lateCross: 0 },
  { id: 4, name: 'Traffic', signals: true, pedestrians: 76, traffic: 28, jaywalk: 0, lateCross: 0.1 },
  { id: 5, name: 'Rush hour', signals: true, pedestrians: 120, traffic: 44, jaywalk: 0.5, lateCross: 0.3 },
];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = DRIVING_LEVELS.length;

export function drivingLevel(id: number): DrivingLevel {
  const k = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(id)));
  return DRIVING_LEVELS[k - 1];
}

/** Share of the population that must arrive safely before the curriculum moves up a level. */
export const ADVANCE_SHARE = 0.2;

/**
 * The automatic curriculum: move up one level once enough of the
 * generation arrived with no crash, red light run or person hit.
 */
export function nextLevel(level: number, safeArrivals: number, population: number): number {
  if (population <= 0 || level >= MAX_LEVEL) return Math.min(level, MAX_LEVEL);
  return safeArrivals / population >= ADVANCE_SHARE ? level + 1 : level;
}

/** Episode time limit for a trip, s: generous enough to wait at every light on the way. */
export function timeLimit(routeLength: number, stops: number): number {
  return Math.round(30 + routeLength / 5 + stops * 15);
}
