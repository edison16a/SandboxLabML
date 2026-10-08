/**
 * The order the racing scene updates in each frame (lower runs first).
 * The driver reads the snapshots and places the followed car, then the
 * camera moves to it, then everything that depends on where the camera
 * is: which cars fade at the lens, tree detail, smoke sorting and the
 * shadow box. Run in mount order instead, those would read last frame's
 * camera, which on a slow frame can be several meters behind. All stay
 * negative: a positive priority would take over rendering in three fiber.
 */
export const FRAME_PRIORITY = { driver: -2, camera: -1 } as const;
