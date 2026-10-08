/** A floor rectangle in a room's own coordinates: its middle and its size along x and z, m. */
export interface FloorBox {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** A player as the action shot sees it: where it stands and how high, its team (0 hiders, 1 seekers) and whether it sleeps. */
export interface ActionPlayer {
  x: number;
  z: number;
  elevation: number;
  team: 0 | 1;
  frozen: boolean;
}

/**
 * The action shot's box: `margin` m of floor round the players, so a
 * runner has somewhere to run before the camera catches up, never
 * narrower than `minSpan`, so one player alone is still seen with the
 * walls and crates round it, and never wider than `maxSpan`, so faces
 * still read when the players are far apart. Then the box keeps the lead
 * player and reaches toward the others as far as it can.
 */
export const ACTION_BOX = { margin: 3.5, minSpan: 9, maxSpan: 13 };

const scratch = { mid: 0, size: 0 };

/**
 * One side of the box into `out`: the players' span `lo` to `hi` plus
 * margins, between minSpan and maxSpan, kept inside [-half, half]. When
 * the span is too wide, the middle moves only as far from the lead
 * player at `lead` as keeps it a margin inside.
 */
function side(lo: number, hi: number, lead: number, half: number, out: { mid: number; size: number }): void {
  const want = hi - lo + 2 * ACTION_BOX.margin;
  const size = Math.min(2 * half, ACTION_BOX.maxSpan, Math.max(ACTION_BOX.minSpan, want));
  let mid = (lo + hi) / 2;
  if (size < want) {
    const reach = Math.max(0, size / 2 - ACTION_BOX.margin);
    mid = Math.max(lead - reach, Math.min(lead + reach, mid));
  }
  const room = half - size / 2;
  out.mid = Math.max(-room, Math.min(room, mid));
  out.size = size;
}

/**
 * The player the shot is about: the first awake seeker while one hunts,
 * else the first hider, who has the stage while seekers sleep through
 * prep. -1 with nobody there.
 */
export function leadPlayer(agents: readonly ActionPlayer[], count: number): number {
  let hider = -1;
  for (let i = 0; i < count; i++) {
    const a = agents[i];
    if (a.team === 1 && !a.frozen) return i;
    if (a.team === 0 && hider < 0) hider = i;
  }
  return hider >= 0 ? hider : count > 0 ? 0 : -1;
}

/**
 * The part of a room worth watching: every player in `agents` (the first
 * `count`), with a margin round them, moved back inside the room (half
 * size `half`, m) so the shot shows floor rather than the city past the
 * walls. Players too far apart for one shot leave the lead player in it
 * (see leadPlayer). With nobody there it is the whole room. Allocates
 * nothing.
 */
export function actionBox(agents: readonly ActionPlayer[], count: number, half: number, out: FloorBox): FloorBox {
  const lead = leadPlayer(agents, count);
  if (lead < 0) {
    out.x = out.z = 0;
    out.w = out.d = 2 * half;
    return out;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const a = agents[i];
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x);
    minZ = Math.min(minZ, a.z);
    maxZ = Math.max(maxZ, a.z);
  }
  side(minX, maxX, agents[lead].x, half, scratch);
  out.x = scratch.mid;
  out.w = scratch.size;
  side(minZ, maxZ, agents[lead].z, half, scratch);
  out.z = scratch.mid;
  out.d = scratch.size;
  return out;
}
