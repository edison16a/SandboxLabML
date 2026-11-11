/**
 * The city's shared life at one moment: other cars, people and lights, in
 * flat typed arrays. The simulation writes it every tick; sensors read it;
 * the renderer decodes the world snapshot into the very same shape, so it
 * can run the learners' sensors itself and draw exactly what they see.
 */
export const MAX_TRAFFIC = 64;
export const MAX_PEDS = 128;

/** Traffic body types. */
export const CAR_SEDAN = 0;
export const CAR_HATCH = 1;
export const CAR_VAN = 2;
export const CAR_TAXI = 3;
export const CAR_KINDS = 4;
/** Footprint per body type, m: length then width. */
export const CAR_DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [4.7, 1.86],
  [4.1, 1.8],
  [5.2, 2.0],
  [4.75, 1.86],
];

/** Traffic flags, a bit each. */
export const FLAG_BRAKE = 1;
export const FLAG_LEFT = 2;
export const FLAG_RIGHT = 4;

/** What a person is doing, for the renderer's walk cycle. */
export const PED_WALK = 0;
export const PED_WAIT = 1;
export const PED_CROSS = 2;
export const PED_JAYWALK = 3;

export interface WorldState {
  /** Seconds since the episode began. */
  time: number;
  signalsOn: boolean;
  carCount: number;
  carX: Float64Array;
  carY: Float64Array;
  carHeading: Float64Array;
  carSpeed: Float64Array;
  carLength: Float64Array;
  carWidth: Float64Array;
  carKind: Uint8Array;
  carFlags: Uint8Array;
  pedCount: number;
  pedX: Float64Array;
  pedY: Float64Array;
  pedHeading: Float64Array;
  /** Walk cycle position, 0 to 1, advancing with distance walked. */
  pedPhase: Float64Array;
  pedState: Uint8Array;
  /** Appearance seed: clothes, build and skin. */
  pedLook: Uint8Array;
  /** Per signal: the light for each approach direction (east, north, west, south bound traffic), -1 where there is no street. */
  lights: Int8Array;
  /** Per signal: the walk signal for crossings walked with north south, then east west traffic. */
  walks: Int8Array;
}

export function createWorldState(signalCount: number): WorldState {
  return {
    time: 0,
    signalsOn: true,
    carCount: 0,
    carX: new Float64Array(MAX_TRAFFIC),
    carY: new Float64Array(MAX_TRAFFIC),
    carHeading: new Float64Array(MAX_TRAFFIC),
    carSpeed: new Float64Array(MAX_TRAFFIC),
    carLength: new Float64Array(MAX_TRAFFIC),
    carWidth: new Float64Array(MAX_TRAFFIC),
    carKind: new Uint8Array(MAX_TRAFFIC),
    carFlags: new Uint8Array(MAX_TRAFFIC),
    pedCount: 0,
    pedX: new Float64Array(MAX_PEDS),
    pedY: new Float64Array(MAX_PEDS),
    pedHeading: new Float64Array(MAX_PEDS),
    pedPhase: new Float64Array(MAX_PEDS),
    pedState: new Uint8Array(MAX_PEDS),
    pedLook: new Uint8Array(MAX_PEDS),
    lights: new Int8Array(signalCount * 4),
    walks: new Int8Array(signalCount * 2),
  };
}
