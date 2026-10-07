/** Which side a character plays for. It sets the body color and nothing else. */
export type CharacterTeam = 'hider' | 'seeker';

/**
 * How much a character costs to draw. Low uses a plain standard material
 * and coarser meshes; full adds the clear coat and sheen. Both get the
 * inner glow.
 */
export type CharacterDetail = 'low' | 'full';

/**
 * What a character is doing this frame, written by whoever owns the
 * simulation and read once per frame by the character. Speed, lean and arm
 * swing are worked out by the character itself from how the position moves,
 * so a caller only reports state, never animation.
 */
export interface CharacterDrive {
  /** Floor position, m, in the parent group's space. */
  x: number;
  z: number;
  /** Heading as in the engine: 0 faces +x, positive turns toward -z. */
  yaw: number;
  /** Cannot act, like a seeker during prep. It sleeps. */
  frozen: boolean;
  /** The other team can see it right now. It looks startled. */
  seen: boolean;
  /** It can see the other team right now. It looks keen. */
  seeing: boolean;
  /** Carrying a box. Its arms reach forward. */
  holding: boolean;
  /** Height of its feet above the floor, m: up a ramp or in a jump. The whole character rises with it. */
  elevation: number;
  /** On a ramp slope. It leans into the slope and takes quick short steps. */
  climbing: boolean;
  /** In the air after running off a ramp lip. Arms up, curled up on the way up, a squash on landing. */
  airborne: boolean;
  /** Set when the character jumped somewhere (a new match, a drag), so it does not animate the jump as a run. */
  teleported: boolean;
}

export function createCharacterDrive(): CharacterDrive {
  return { x: 0, z: 0, yaw: 0, frozen: false, seen: false, seeing: false, holding: false, elevation: 0, climbing: false, airborne: false, teleported: true };
}
