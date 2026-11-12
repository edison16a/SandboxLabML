import { describe, expect, it } from 'vitest';
import { firstSentence } from './firstSentence';

describe('firstSentence', () => {
  it('keeps the first sentence with its period', () => {
    expect(firstSentence('Empty streets. No lights, people or traffic yet.')).toBe('Empty streets.');
  });

  it('adds a period to a single sentence that lacks one', () => {
    expect(firstSentence('Progress, a bonus for arriving and small costs')).toBe('Progress, a bonus for arriving and small costs.');
    expect(firstSentence('One sentence.')).toBe('One sentence.');
  });

  it('does not split on a decimal point', () => {
    expect(firstSentence('A runner turns at 1.2 rad per second. Then more.')).toBe('A runner turns at 1.2 rad per second.');
  });
});
