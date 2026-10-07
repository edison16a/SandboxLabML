import { describe, expect, it } from 'vitest';
import { CharacterMotion } from './characterMotion';
import { createCharacterDrive } from './types';

const DT = 1 / 60;

/** Runs `frames` frames, calling `step` to move the drive before each one. */
function run(motion: CharacterMotion, frames: number, step: (d: ReturnType<typeof createCharacterDrive>, i: number) => void, d = createCharacterDrive()) {
  let pose = motion.update(d, DT, 0);
  for (let i = 1; i <= frames; i++) {
    step(d, i);
    pose = motion.update(d, DT, i * DT);
  }
  return pose;
}

describe('CharacterMotion', () => {
  it('stands still with a happy face and arms at rest', () => {
    const pose = run(new CharacterMotion(), 120, () => {});
    expect(pose.expression).toBe('happy');
    expect(Math.abs(pose.swing)).toBeLessThan(1e-3);
    expect(Math.abs(pose.lean)).toBeLessThan(1e-3);
    expect(pose.reach).toBe(0);
    expect(pose.awake).toBeCloseTo(1, 3);
  });

  it('leans into a forward run and swings its arms', () => {
    let widest = 0;
    const motion = new CharacterMotion();
    const pose = run(motion, 90, (d) => {
      d.x += 3 * DT;
      widest = Math.max(widest, Math.abs(motion.pose.swing));
    });
    expect(pose.lean).toBeGreaterThan(0.1);
    expect(widest).toBeGreaterThan(0.4);
  });

  it('leans back when backing up', () => {
    const pose = run(new CharacterMotion(), 60, (d) => {
      d.x -= 1.5 * DT;
    });
    expect(pose.lean).toBeLessThan(0);
  });

  it('does not run across a teleport', () => {
    const motion = new CharacterMotion();
    const d = createCharacterDrive();
    run(motion, 30, () => {}, d);
    d.x = 8;
    d.teleported = true;
    const pose = motion.update(d, DT, 1);
    expect(Math.abs(pose.lean)).toBeLessThan(1e-3);
    expect(d.teleported).toBe(false);
  });

  it('falls asleep when frozen and wakes up after', () => {
    const motion = new CharacterMotion();
    const asleep = run(motion, 120, (d) => void (d.frozen = true));
    expect(asleep.expression).toBe('sleep');
    expect(asleep.awake).toBeLessThan(0.1);
    const awake = run(motion, 120, (d) => void (d.frozen = false));
    expect(awake.expression).toBe('happy');
    expect(awake.awake).toBeGreaterThan(0.9);
  });

  it('hops and throws its arms up when first seen', () => {
    const motion = new CharacterMotion();
    run(motion, 60, () => {});
    let highest = 0;
    const pose = run(motion, 30, (d) => {
      d.seen = true;
      highest = Math.max(highest, motion.pose.bob);
    });
    expect(pose.expression).toBe('startled');
    expect(highest).toBeGreaterThan(0.1);
    expect(pose.raise).toBeGreaterThan(0.9);
  });

  it('reaches forward while holding a box', () => {
    const pose = run(new CharacterMotion(), 60, (d) => void (d.holding = true));
    expect(pose.reach).toBeGreaterThan(0.95);
  });

  it('leans into a ramp and takes quicker steps up it than on the floor', () => {
    const steps = (climbing: boolean) => {
      const motion = new CharacterMotion();
      let flips = 0;
      let last = 0;
      const pose = run(motion, 90, (d) => {
        d.x += 2 * DT;
        d.climbing = climbing;
        d.elevation = climbing ? d.x * 0.5 : 0;
        if (Math.sign(motion.pose.swing) !== Math.sign(last)) flips++;
        last = motion.pose.swing;
      });
      return { flips, lean: pose.lean };
    };
    const floor = steps(false);
    const slope = steps(true);
    expect(slope.lean).toBeGreaterThan(0.35);
    expect(slope.lean).toBeGreaterThan(floor.lean + 0.15);
    expect(slope.flips).toBeGreaterThan(floor.flips * 1.5);
  });

  it('jumps with its arms up, curled while rising, and squashes on landing', () => {
    const motion = new CharacterMotion();
    run(motion, 30, () => {});
    let curled = 1;
    const air = run(motion, 15, (d, i) => {
      d.airborne = true;
      d.x += 6 * DT;
      d.elevation = 1.2 + Math.sin((i / 15) * Math.PI) * 0.4;
      if (i < 6) curled = Math.min(curled, motion.pose.squash);
    });
    expect(air.leap).toBeGreaterThan(0.9);
    expect(curled).toBeLessThan(0.95);
    let flattest = 1;
    run(motion, 12, (d) => {
      d.airborne = false;
      d.elevation = 0;
      flattest = Math.min(flattest, motion.pose.squash);
    });
    expect(flattest).toBeLessThan(0.88);
    const settled = run(motion, 60, () => {});
    expect(settled.squash).toBeGreaterThan(0.95);
  });
});
