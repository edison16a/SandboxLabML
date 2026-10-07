import { describe, expect, it } from 'vitest';
import { CharacterMotion } from './motion/characterMotion';
import { blockedAhead, boxShape, findContact, lookAt, worthALook } from './perception';
import { CONTACT_HOLD, CONTACT_NONE, CONTACT_PUSH, createCharacterDrive } from './types';

/** A drive facing +x at (x, z). */
function at(x: number, z: number) {
  const d = createCharacterDrive();
  d.x = x;
  d.z = z;
  return d;
}

describe('character perception', () => {
  it('puts hands on the face of a box the agent stands against', () => {
    const box = Object.assign(boxShape(), { x: 1, z: 0 });
    const d = at(0.06, 0);
    findContact(d, [box], 1);
    expect(d.contact).toBe(CONTACT_PUSH);
    expect(d.contactX).toBeCloseTo(0.5, 5);
    expect(d.contactNX).toBeCloseTo(-1, 5);
    expect(blockedAhead(d, [])).toBe(true);
  });

  it('grips the box it carries even a step away, and ignores boxes behind it', () => {
    const ahead = Object.assign(boxShape(), { x: 1.3, z: 0.2 });
    const behind = Object.assign(boxShape(), { x: -0.9, z: 0 });
    const d = at(0, 0);
    d.holding = true;
    findContact(d, [behind, ahead], 2);
    expect(d.contact).toBe(CONTACT_HOLD);
    expect(d.contactX).toBeCloseTo(0.8, 5);
    d.holding = false;
    findContact(d, [behind], 1);
    expect(d.contact).toBe(CONTACT_NONE);
  });

  it('feels a wall right in front of it but not one beside it', () => {
    const wall = { x: 0.6, z: 0, hx: 0.1, hz: 3 };
    expect(blockedAhead(at(0, 0), [wall])).toBe(true);
    expect(blockedAhead(at(-2, 0), [wall])).toBe(false);
  });

  it('looks at an agent that sees it, and glances at one only when it is near', () => {
    const d = at(0, 0);
    expect(worthALook(d, 9, 0, true)).toBe(true);
    expect(worthALook(d, 9, 0, false)).toBe(false);
    expect(worthALook(d, 2, 1, false)).toBe(true);
    lookAt(d, 3, 4, 0.5);
    expect(d.look && d.lookY > 1).toBe(true);
  });

  it('bumps forward when it stops dead against a wall, and not when it simply stops', () => {
    const peak = (blocked: boolean) => {
      const m = new CharacterMotion();
      const d = createCharacterDrive();
      let most = 0;
      for (let i = 0; i < 150; i++) {
        const v = i < 90 ? 3.5 : 0;
        if (i % 2 === 0) d.x += (v * 2) / 60;
        d.blocked = blocked && i >= 88;
        const p = m.update(d, 1 / 60, i / 60);
        if (i > 90) most = Math.max(most, p.lean);
      }
      return most;
    };
    expect(peak(true)).toBeGreaterThan(peak(false) + 0.05);
  });
});
