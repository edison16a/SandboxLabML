import { describe, expect, it } from 'vitest';
import { emptyRoom, SANDBOX_LIMITS, type SandboxRoom } from '../sandbox/room';
import { addWall, eraseAt, moveBox, placeBox, quarterTurn, setSpawn, snap, spawnAround, straightWall, turnBox } from '../sandbox/roomEdit';
import { sanitizeRoom } from '../sandbox/validate';

const base = emptyRoom('r', 'Room');
const ok = (r: { room?: SandboxRoom; error?: string }): SandboxRoom => {
  if (!r.room) throw new Error(r.error);
  return r.room;
};

describe('room editing', () => {
  it('snaps to half meters and straightens walls along the main axis of the drag', () => {
    expect(snap(1.26)).toBe(1.5);
    expect(snap(-12)).toBe(-10);
    expect(straightWall([0, 0], [4, 1])).toEqual({ from: [0, 0], to: [4, 0] });
    expect(straightWall([0, 0], [1, -5])).toEqual({ from: [0, 0], to: [0, -5] });
  });

  it('adds walls, refuses one that is too short or runs through a box', () => {
    let room = ok(addWall(base, [-4, -2], [4, -2.5]));
    expect(room.walls).toEqual([{ from: [-4, -2], to: [4, -2] }]);
    expect(addWall(room, [1, 1], [1.2, 1]).error).toMatch(/further/);
    room = ok(placeBox(room, 'cube', 3, 3, 0));
    expect(addWall(room, [0, 3], [6, 3]).error).toMatch(/through a box/);
  });

  it('places boxes inside the room and clear of walls and other boxes', () => {
    let room = ok(addWall(base, [0, -10], [0, 10]));
    expect(placeBox(room, 'cube', 0.5, 0, 0).error).toMatch(/No space/);
    room = ok(placeBox(room, 'plank', 50, 0, 0));
    expect(room.boxes[0].x).toBeLessThanOrEqual(10 - 1.2);
    expect(placeBox(room, 'cube', room.boxes[0].x, 0, 0).error).toMatch(/No space/);
    // A plank along z fits in a gap a plank along x does not.
    room = ok(placeBox(room, 'plank', 3, 5, Math.PI / 2));
    const turned = turnBox(room, 1);
    expect(turned.room?.boxes[1].yaw).toBe(0);
  });

  it('places ramps like crates and turns them through all four uphill directions', () => {
    expect(quarterTurn(0)).toBe(Math.PI / 2);
    expect(quarterTurn(Math.PI)).toBe((3 * Math.PI) / 2);
    expect(quarterTurn((3 * Math.PI) / 2)).toBe(0);
    expect(quarterTurn(-Math.PI / 2)).toBe(0);
    let room = ok(placeBox(base, 'ramp', 0, 0, 0));
    expect(room.boxes[0]).toEqual({ x: 0, z: 0, yaw: 0, kind: 'ramp' });
    // A ramp is 2.4 m long, so a cube right next to its lip does not fit.
    expect(placeBox(room, 'cube', 1.5, 0, 0).error).toMatch(/No space/);
    const yaws = [];
    for (let i = 0; i < 4; i++) {
      room = ok(turnBox(room, 0));
      yaws.push(room.boxes[0].yaw);
    }
    expect(yaws).toEqual([Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0]);
    // Turned toward the outer wall, it stays inside the room.
    room = ok(placeBox(base, 'ramp', 10, 0, Math.PI / 2));
    room = ok(turnBox(room, 0));
    expect(room.boxes[0].x + 1.2).toBeLessThanOrEqual(10);
    expect(sanitizeRoom(JSON.parse(JSON.stringify(room)))).toEqual(room);
  });

  it('moves a box only where it fits, and erases the box or wall under a point', () => {
    let room = ok(placeBox(base, 'cube', -5, -5, 0));
    room = ok(placeBox(room, 'cube', 5, 5, 0));
    expect(moveBox(room, 0, 5, 5.5).error).toMatch(/No space/);
    room = ok(moveBox(room, 0, 0, 0));
    expect(room.boxes[0]).toMatchObject({ x: 0, z: 0 });
    room = ok(addWall(room, [-6, 8], [6, 8]));
    expect(eraseAt(room, 0.2, 0.3)?.boxes).toHaveLength(1);
    expect(eraseAt(room, 3, 8.2)?.walls).toHaveLength(0);
    expect(eraseAt(room, -8, -8)).toBeNull();
  });

  it('keeps spawn areas inside the room and at least a meter each way', () => {
    const room = setSpawn(base, 'seeker', { minX: 9.8, maxX: 14, minZ: 2, maxZ: 2 });
    expect(room.seekerSpawn.maxX).toBe(10);
    expect(room.seekerSpawn.maxX - room.seekerSpawn.minX).toBeGreaterThanOrEqual(1);
    expect(room.seekerSpawn.maxZ - room.seekerSpawn.minZ).toBeGreaterThanOrEqual(1);
    expect(spawnAround(9, 0)).toEqual({ minX: 6, maxX: 10, minZ: -2, maxZ: 2 });
  });

  it('stops at the limits, and whatever it makes survives a save and load unchanged', () => {
    let room = base;
    for (let i = 0; i < SANDBOX_LIMITS.walls; i++) room = ok(addWall(room, [-9, -9 + i * 0.35], [-8, -9 + i * 0.35]));
    expect(addWall(room, [5, 5], [8, 5]).error).toMatch(/at most/);
    expect(sanitizeRoom(JSON.parse(JSON.stringify(room)))).toEqual(room);
  });
});
