/**
 * Two slots of the world block's header that a Driving generation fills
 * (see DrivingTrips.writeWorld): which trip is on screen and how many there
 * are. The rest of the header is the city's (see snapshot.ts). A file of
 * its own, so the lab can read them without the simulation.
 */
export const WORLD_TRIP = 6;
export const WORLD_TRIPS = 7;

/** The trip a frame shows, from its world block at `offset`. 0 for a buffer without one. */
export function tripOf(buffer: Float32Array, offset: number): number {
  return offset + WORLD_TRIP < buffer.length ? buffer[offset + WORLD_TRIP] : 0;
}

/** How many trips the generation of a frame drives. */
export function tripsOf(buffer: Float32Array, offset: number): number {
  return offset + WORLD_TRIPS < buffer.length ? Math.max(1, buffer[offset + WORLD_TRIPS]) : 1;
}
