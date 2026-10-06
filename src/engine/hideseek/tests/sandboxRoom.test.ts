import { describe, expect, it } from 'vitest';
import { distanceToBox, distanceToRect } from '../layouts/geometry';
import { HIDESEEK_LAYOUTS } from '../layouts/presets';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { DEFAULT_ROOM_ID, emptyRoom, PRESET_ROOMS, presetRoom, roomById, roomWallRects, SANDBOX_LIMITS } from '../sandbox/room';
import { sandboxSetup } from '../sandbox/spawn';
import { sanitizeRoom } from '../sandbox/validate';
import { DRAWN_ROOM } from './sandboxHelpers';

const P = DEFAULT_HIDESEEK_PHYSICS;

describe('Sandbox rooms', () => {
  it('turns every preset layout into a room with the same walls, boxes and spawns', () => {
    expect(PRESET_ROOMS.map((r) => r.id)).toEqual(['open', 'shelter', 'corridor']);
    const shelter = presetRoom('shelter');
    expect(shelter.walls).toEqual(HIDESEEK_LAYOUTS.shelter.walls);
    expect(shelter.boxes.map((b) => b.kind)).toEqual(['cube', 'cube', 'plank', 'plank']);
    expect(shelter.hiderSpawn).toEqual(HIDESEEK_LAYOUTS.shelter.hiderSpawn);
  });

  it('finds a room by id: a preset, a room the user drew, or the default room when it is gone', () => {
    expect(roomById('corridor', [DRAWN_ROOM])).toEqual(presetRoom('corridor'));
    expect(roomById(DRAWN_ROOM.id, [DRAWN_ROOM])).toBe(DRAWN_ROOM);
    expect(roomById('deleted', [DRAWN_ROOM])).toEqual(presetRoom(DEFAULT_ROOM_ID));
  });

  it('cleans a stored room: no slanted walls, boxes inside, spawn areas big enough, lists capped', () => {
    const raw = {
      id: 'x',
      name: '   ',
      walls: [{ from: [0, 0], to: [3, 3] }, { from: [-12, 2], to: [4, 2] }, { from: [1, 1], to: [1, 1] }, 'junk'],
      boxes: [{ x: 50, z: -50, yaw: 0, kind: 'cube' }, { x: 0, z: 0, kind: 'ramp' }, ...Array.from({ length: 40 }, () => ({ x: 1, z: 1, yaw: 0, kind: 'plank' }))],
      hiderSpawn: { minX: 3, maxX: 3, minZ: 0, maxZ: 2 },
      seekerSpawn: null,
    };
    const room = sanitizeRoom(raw);
    expect(room).not.toBeNull();
    expect(room!.name).toBe('Custom room');
    expect(room!.walls).toEqual([{ from: [-10, 2], to: [4, 2] }]);
    expect(room!.boxes).toHaveLength(SANDBOX_LIMITS.boxes);
    expect(room!.boxes[0].x).toBeLessThan(10);
    expect(room!.boxes[0].z).toBeGreaterThan(-10);
    expect(room!.hiderSpawn.maxX - room!.hiderSpawn.minX).toBeGreaterThanOrEqual(1);
    expect(room!.seekerSpawn.maxX).toBeGreaterThan(room!.seekerSpawn.minX);
    expect(sanitizeRoom({ id: '', walls: [], boxes: [] })).toBeNull();
    expect(sanitizeRoom('nope')).toBeNull();
  });

  it('spawns eight a side clear of walls, boxes and each other, the same way for the same seed', () => {
    const setup = sandboxSetup(DRAWN_ROOM, P, 9, 8, 8);
    expect(setup.agents).toHaveLength(16);
    const walls = roomWallRects(DRAWN_ROOM, P);
    const r = P.agent.radius;
    setup.agents.forEach((a, i) => {
      for (const w of walls) expect(distanceToRect(a.x, a.z, w)).toBeGreaterThan(r);
      for (const b of setup.boxes) {
        const s = boxKindSize(P, b.kind);
        expect(distanceToBox(a.x, a.z, b.pose.x, b.pose.z, s.length / 2, s.width / 2, b.pose.yaw)).toBeGreaterThan(r);
      }
      for (const o of setup.agents.slice(i + 1)) expect(Math.hypot(a.x - o.x, a.z - o.z)).toBeGreaterThan(2 * r);
    });
    expect(sandboxSetup(DRAWN_ROOM, P, 9, 8, 8)).toEqual(setup);
    // Hiders start in the hider area.
    for (const a of setup.agents.slice(0, 8)) expect(a.x).toBeLessThan(0);
  });

  it('finds room in the rest of the room when a spawn area is too small for everyone', () => {
    const tiny = { ...emptyRoom('t', 'Tiny'), hiderSpawn: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 } };
    const setup = sandboxSetup(tiny, P, 3, 8, 1);
    const r = P.agent.radius;
    setup.agents.forEach((a, i) => {
      for (const o of setup.agents.slice(i + 1)) expect(Math.hypot(a.x - o.x, a.z - o.z)).toBeGreaterThan(2 * r);
    });
  });
});
