import { describe, expect, it } from 'vitest';
import { sandboxCourseSpec } from '@/features/navigation/session/sandboxScene';
import { SANDBOX_SEED as LAB_SANDBOX_SEED, STARTING_COPIES } from '@/features/navigation/state/sandboxState';
import { chooseContender } from './pick';
import { MODEL_COPIES, SANDBOX_COURSES, SANDBOX_SEED } from './sandboxCourses';

const contender = (finish: number, score: number, generation = 60) => ({ finish, score, generation });

describe('the Navigation model pick', () => {
  it('ships the best Sandbox finisher among those that reach the tier score', () => {
    expect(chooseContender([contender(1, 70), contender(0.9, 85), contender(0.8, 92)], 80)).toEqual(contender(0.9, 85));
  });

  it('falls back to the best finisher when none reaches the tier score', () => {
    expect(chooseContender([contender(0.7, 60), contender(0.95, 50)], 80)).toEqual(contender(0.95, 50));
  });

  it('breaks a tie toward the higher score, then the later generation', () => {
    expect(chooseContender([contender(1, 82), contender(1, 90)], 80).score).toBe(90);
    expect(chooseContender([contender(1, 90, 40), contender(1, 90, 55)], 80).generation).toBe(55);
  });
});

describe('the Sandbox courses the pick drives', () => {
  it('match what the lab Sandbox plays', () => {
    expect(SANDBOX_SEED).toBe(LAB_SANDBOX_SEED);
    expect(MODEL_COPIES).toBe(STARTING_COPIES);
    // The first course is the one every newcomer opens on.
    expect(SANDBOX_COURSES[0].spec).toEqual(sandboxCourseSpec({ kind: 'level', level: 1, seed: LAB_SANDBOX_SEED }, []));
  });
});
