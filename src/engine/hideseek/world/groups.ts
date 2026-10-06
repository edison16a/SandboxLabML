/**
 * Rapier collision groups. Every solid collides with every other solid;
 * the groups exist so sight lines can pass through agents while walls and
 * boxes still block them.
 */
export const GROUP_WALL = 0x1;
export const GROUP_BOX = 0x2;
export const GROUP_AGENT = 0x4;
const ALL = 0xffff;

/** Packs memberships and filter the way Rapier expects: memberships in the high 16 bits. */
export function interactionGroups(memberships: number, filter: number): number {
  return ((memberships << 16) | filter) >>> 0;
}

export const WALL_GROUPS = interactionGroups(GROUP_WALL, ALL);
export const BOX_GROUPS = interactionGroups(GROUP_BOX, ALL);
export const AGENT_GROUPS = interactionGroups(GROUP_AGENT, ALL);

/** Query groups for sight lines: they ignore both agents and stop at walls and boxes. */
export const SIGHT_GROUPS = interactionGroups(ALL, GROUP_WALL | GROUP_BOX);
