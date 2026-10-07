/**
 * Proportions of the character, m, in its own frame: x ahead, y up from
 * the soles, z to its right. It stands about 1.5 m tall inside the 0.4 m
 * collision radius of an agent: a big round head on a small bean of a
 * body, on short legs, like the hide and seek classics. Motion and meshes
 * both read these, so the joints the physics moves are the joints drawn.
 */
export const RIG = {
  /** Hip joints at rest: height and half the distance between them. */
  hipY: 0.43,
  hipZ: 0.092,
  thigh: 0.19,
  shin: 0.19,
  thighRadius: 0.056,
  shinRadius: 0.047,
  /** The ankle stands this high over the sole. */
  ankleY: 0.075,
  /** A foot: half its length, height and width, and how far its middle sits ahead of the ankle. */
  foot: { hx: 0.105, hy: 0.048, hz: 0.062, ahead: 0.035 },
  /** The body, measured from the pelvis (the hip line): from its round bottom to the neck. */
  bodyBottom: -0.13,
  bodyTop: 0.5,
  /** The head's center over the pelvis, and its radius before the bun scale. */
  headY: 0.7,
  headRadius: 0.36,
  /** The head is a touch wider than tall, like a bun. */
  headScale: [1.06, 0.95, 1.06] as const,
  /** Shoulders over the pelvis and out to each side. */
  shoulderY: 0.35,
  shoulderZ: 0.175,
  upperArm: 0.15,
  forearm: 0.14,
  upperArmRadius: 0.043,
  forearmRadius: 0.038,
  handRadius: 0.058,
  /** Eyes: direction from the head's center (azimuth to each side, elevation up), eyeball radius and how deep it sits. */
  eye: { azimuth: 0.33, elevation: 0.1, radius: 0.09, sink: 0.046 },
} as const;

/** Full leg reach from hip to ankle, m, with a hair of bend kept so a knee never snaps straight. */
export const LEG_REACH = (RIG.thigh + RIG.shin) * 0.985;

/** Where the head's center sits in the body's frame, as a point. */
export const HEAD_CENTER = { x: 0, y: RIG.headY, z: 0 } as const;

/**
 * The center of eye `side` (-1 left, +1 right) in the head's frame: on the
 * bun scaled head surface, sunk in a little, so the eyeball bulges out of
 * the face rather than floating on it.
 */
export function eyeCenter(side: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const { azimuth, elevation, sink } = RIG.eye;
  const [sx, sy, sz] = RIG.headScale;
  const r = RIG.headRadius;
  const nx = Math.cos(elevation) * Math.cos(azimuth);
  const ny = Math.sin(elevation);
  const nz = side * Math.cos(elevation) * Math.sin(azimuth);
  out.x = nx * (r * sx - sink);
  out.y = ny * (r * sy - sink);
  out.z = nz * (r * sz - sink);
  return out;
}
