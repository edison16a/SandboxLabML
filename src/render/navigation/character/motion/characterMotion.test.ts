import { describe, expect, it } from 'vitest';
import { RIG } from '../rig/proportions';
import { CONTACT_HOLD, createCharacterDrive, type CharacterDrive } from '../types';
import { CharacterMotion } from './characterMotion';
import { cadence } from './gait';
import type { CharacterPose } from './pose';

const DT = 1 / 60;

/** Runs `frames` frames, calling `step` to move the drive before each one, and `watch` after. */
function run(motion: CharacterMotion, frames: number, step: (d: CharacterDrive, i: number) => void, d: CharacterDrive, watch?: (p: CharacterPose, i: number) => void) {
  for (let i = 1; i <= frames; i++) {
    step(d, i);
    const p = motion.update(d, DT, i * DT);
    watch?.(p, i);
  }
  return motion.pose;
}

describe('CharacterMotion', () => {
  it('stands still on both feet with a happy face and settles', () => {
    const m = new CharacterMotion();
    const pose = run(m, 120, () => {}, createCharacterDrive());
    expect(pose.expression).toBe('happy');
    expect(m.feet.every((f) => f.planted)).toBe(true);
    expect(Math.abs(pose.lean)).toBeLessThan(0.02);
    for (const a of pose.ankles) expect(a.y).toBeCloseTo(RIG.ankleY, 2);
  });

  it('never slides a planted foot while it walks and runs', () => {
    for (const speed of [0.8, 2, 3.5]) {
      const m = new CharacterMotion();
      const d = createCharacterDrive();
      run(m, 10, () => {}, d);
      const held = [null, null] as Array<{ x: number; z: number } | null>;
      let worst = 0;
      let steps = 0;
      run(m, 180, (dd) => void (dd.x += speed * DT), d, () => {
        m.feet.forEach((f, s) => {
          if (!f.planted) held[s] = null;
          else if (!held[s]) {
            held[s] = { x: f.pos.x, z: f.pos.z };
            steps++;
          } else worst = Math.max(worst, Math.hypot(f.pos.x - held[s]!.x, f.pos.z - held[s]!.z));
        });
      });
      expect(worst).toBeLessThan(1e-9);
      // Footfalls come at the cadence the speed sets, give or take the first strides.
      expect(steps).toBeGreaterThan(cadence(speed) * 2 * 3 * 0.6);
    }
  });

  it('leans into a run, rocks back when it stops, and banks toward the inside of a turn', () => {
    const m = new CharacterMotion();
    const d = createCharacterDrive();
    let most = 0;
    run(m, 60, (dd) => void (dd.x += 3 * DT), d, (p) => (most = Math.max(most, p.lean)));
    expect(most).toBeGreaterThan(0.15);
    let least = 1;
    run(m, 40, () => {}, d, (p) => (least = Math.min(least, p.lean)));
    expect(least).toBeLessThan(0);
    // A left turn (yaw up) at speed pulls toward -z, the left: the body rolls that way.
    const turn = new CharacterMotion();
    const t = createCharacterDrive();
    const roll = run(turn, 90, (dd) => {
      dd.yaw += 2 * DT;
      dd.x += Math.cos(dd.yaw) * 3 * DT;
      dd.z -= Math.sin(dd.yaw) * 3 * DT;
    }, t).roll;
    expect(roll).toBeLessThan(-0.05);
  });

  it('tucks its legs in a jump and lands on bent knees', () => {
    const m = new CharacterMotion();
    const d = createCharacterDrive();
    run(m, 30, () => {}, d);
    let tucked = 1;
    run(m, 15, (dd, i) => {
      dd.airborne = true;
      dd.x += 4 * DT;
      dd.elevation = 1.2 + Math.sin((i / 15) * Math.PI) * 0.4 - (i / 15) * 1.2;
    }, d, (p) => (tucked = Math.min(tucked, p.hips[0].y - p.ankles[0].y)));
    expect(tucked).toBeLessThan(0.3);
    let lowest = 1;
    run(m, 20, (dd) => {
      dd.airborne = false;
      dd.elevation = 0;
    }, d, (p) => (lowest = Math.min(lowest, p.pelvis.y)));
    expect(lowest).toBeLessThan(RIG.hipY - 0.06);
    const settled = run(m, 90, () => {}, d);
    expect(settled.pelvis.y).toBeGreaterThan(RIG.hipY - 0.03);
  });

  it('turns its head and eyes toward what it sees, and wakes up after sleeping', () => {
    const m = new CharacterMotion();
    const d = createCharacterDrive();
    const pose = run(m, 60, (dd) => {
      dd.look = true;
      dd.lookX = 0;
      dd.lookZ = -5;
      dd.lookY = 1;
      dd.seeing = true;
    }, d);
    // The target is to its left (-z): head and eyes turn left, which is positive yaw.
    expect(pose.headYaw + pose.twist + pose.gazeYaw).toBeGreaterThan(0.9);
    expect(pose.expression).toBe('keen');
    const asleep = run(m, 120, (dd) => void (dd.frozen = true), d);
    expect(asleep.expression).toBe('sleep');
    expect(asleep.lidUpper).toBeGreaterThan(0.9);
    const awake = run(m, 120, (dd) => {
      dd.frozen = false;
      dd.look = false;
      dd.seeing = false;
    }, d);
    expect(awake.expression).toBe('happy');
    expect(awake.awake).toBeGreaterThan(0.9);
  });

  it('reaches both hands for a box it carries', () => {
    const m = new CharacterMotion();
    const d = createCharacterDrive();
    const pose = run(m, 60, (dd) => {
      dd.holding = true;
      dd.contact = CONTACT_HOLD;
      dd.contactX = 0.65;
      dd.contactZ = 0;
      dd.contactNX = -1;
      dd.contactNZ = 0;
      dd.contactHeight = 1;
    }, d);
    for (const h of pose.hands) expect(h.x).toBeGreaterThan(0.2);
    expect(pose.hands[0].z).toBeLessThan(pose.hands[1].z);
    expect(pose.expression).toBe('effort');
  });

  it('jumps across a teleport without running', () => {
    const m = new CharacterMotion();
    const d = createCharacterDrive();
    run(m, 30, () => {}, d);
    d.x = 8;
    d.teleported = true;
    const pose = m.update(d, DT, 1);
    expect(Math.abs(pose.lean)).toBeLessThan(0.02);
    expect(m.feet.every((f) => f.planted && Math.abs(f.pos.x - 8) < 0.2)).toBe(true);
  });
});
