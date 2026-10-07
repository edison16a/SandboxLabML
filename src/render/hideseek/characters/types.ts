/** Which side a character plays for. It sets the body color and nothing else. */
export type CharacterTeam = 'hider' | 'seeker';

/**
 * How much a character costs to draw. Low uses a plain standard material
 * and coarser meshes; full adds the clear coat. Both move the same way.
 */
export type CharacterDetail = 'low' | 'full';

/** What a character's hands are on: nothing, a box it leans into, or a box it carries. */
export const CONTACT_NONE = 0;
export const CONTACT_PUSH = 1;
export const CONTACT_HOLD = 2;

/**
 * What a character is doing this frame, written by whoever owns the
 * simulation and read once per frame by the character. Speed, momentum,
 * footsteps and everything else the body does are worked out by the
 * character itself from how the position moves, so a caller only reports
 * state, never animation.
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
  /** Carrying a box. */
  holding: boolean;
  /** Height of its feet above the floor, m: up a ramp or in a jump. The whole character rises with it. */
  elevation: number;
  /** On a ramp slope. It leans into the slope and steps up it. */
  climbing: boolean;
  /** In the air after running off a ramp lip: legs tucked, arms out, then a landing on bent knees. */
  airborne: boolean;
  /** Set when the character jumped somewhere (a new match, a drag), so it does not animate the jump as a run. */
  teleported: boolean;
  /** Something worth looking at, in the same space as x and z, and its height: the agent it sees or that sees it. */
  look: boolean;
  lookX: number;
  lookY: number;
  lookZ: number;
  /** What its hands are on (CONTACT_*), the middle of the box face it touches, that face's outward normal, and the box's height. */
  contact: number;
  contactX: number;
  contactZ: number;
  contactNX: number;
  contactNZ: number;
  contactHeight: number;
  /** Something solid (a wall, a box) is right in front of it, so a sudden stop is a collision. */
  blocked: boolean;
}

export function createCharacterDrive(): CharacterDrive {
  return {
    x: 0,
    z: 0,
    yaw: 0,
    frozen: false,
    seen: false,
    seeing: false,
    holding: false,
    elevation: 0,
    climbing: false,
    airborne: false,
    teleported: true,
    look: false,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
    contact: CONTACT_NONE,
    contactX: 0,
    contactZ: 0,
    contactNX: 1,
    contactNZ: 0,
    contactHeight: 1,
    blocked: false,
  };
}
