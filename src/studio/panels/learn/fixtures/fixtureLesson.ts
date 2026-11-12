import type { Lesson } from '@/engine/lessons/types';

/**
 * A two step lesson for tests only. The real lessons live in the catalog,
 * which another part of the app fills in; this keeps the player's tests
 * independent of that content.
 */
export const FIXTURE_LESSON: Lesson = {
  id: 'fixture-first-reward',
  course: 'driving',
  order: 1,
  title: 'Your first reward',
  summary: 'Give points for arriving.',
  minutes: 3,
  steps: [
    {
      id: 'drive',
      title: 'Let the brain drive',
      body: 'An SUV only moves when a script calls **drive**.\n\n- Add `drive(steer: brain.steer, pedal: brain.pedal)`\n- Press **Check**',
      starter: 'script "First reward" for driving v1\n\neach tick {\n}\n',
      highlight: { lines: [3, 4] },
      check: { kind: 'astContains', anyOf: [{ stmt: 'call', scope: 'tick', callee: 'drive' }], message: 'Call drive inside each tick.' },
      hints: ['drive goes inside each tick.', 'Pass brain.steer and brain.pedal to drive.'],
      solution: 'script "First reward" for driving v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n',
    },
    {
      id: 'reward',
      title: 'Reward arriving',
      body: 'Give ten points for arriving.',
      starter: 'script "First reward" for driving v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n',
      check: { kind: 'astContains', anyOf: [{ stmt: 'reward', scope: 'tick', uses: ['car.arrived'] }], message: 'Add a reward that uses car.arrived.' },
      hints: ['Rewards start with the word reward.', 'Try reward +10 when car.arrived'],
      solution: 'script "First reward" for driving v1\n\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n  reward +10 when car.arrived\n}\n',
    },
  ],
};
