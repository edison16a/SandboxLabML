import type { Lesson } from '@/engine/lessons/types';

/**
 * A two step lesson for tests only. The real lessons live in the catalog,
 * which another part of the app fills in; this keeps the player's tests
 * independent of that content.
 */
export const FIXTURE_LESSON: Lesson = {
  id: 'fixture-first-reward',
  course: 'racing',
  order: 1,
  title: 'Your first reward',
  summary: 'Give points for checkpoints.',
  minutes: 3,
  steps: [
    {
      id: 'drive',
      title: 'Let the brain drive',
      body: 'Cars only move when a script calls **drive**.\n\n- Add `drive(steer: brain.steer, pedal: brain.pedal)`\n- Press **Check**',
      starter: 'script "First reward" for racing v1\n\neach tick {\n}\n',
      highlight: { lines: [3, 4] },
      check: { kind: 'astContains', anyOf: [{ stmt: 'call', scope: 'tick', callee: 'drive' }], message: 'Call drive inside each tick.' },
      hints: ['drive goes inside each tick.', 'Pass brain.steer and brain.pedal to drive.'],
      solution: 'script "First reward" for racing v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n',
    },
    {
      id: 'reward',
      title: 'Reward progress',
      body: 'Give one point for every checkpoint.',
      starter: 'script "First reward" for racing v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n',
      check: { kind: 'astContains', anyOf: [{ stmt: 'reward', scope: 'tick', uses: ['checkpoint.passed'] }], message: 'Add a reward that uses checkpoint.passed.' },
      hints: ['Rewards start with the word reward.', 'Try reward +1 when checkpoint.passed'],
      solution: 'script "First reward" for racing v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +1 when checkpoint.passed\n}\n',
    },
  ],
};
