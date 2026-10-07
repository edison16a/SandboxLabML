import { describe, expect, it } from 'vitest';
import { firstSentence } from './firstSentence';

describe('firstSentence', () => {
  it('keeps the first sentence with its period', () => {
    expect(firstSentence('An empty room. The only cover is what the hider builds.')).toBe('An empty room.');
  });

  it('adds a period to a single sentence that lacks one', () => {
    expect(firstSentence('Checkpoints, laps and a little speed')).toBe('Checkpoints, laps and a little speed.');
    expect(firstSentence('One sentence.')).toBe('One sentence.');
  });

  it('does not split on a decimal point', () => {
    expect(firstSentence('Grip of 1.2 g in corners. Then more.')).toBe('Grip of 1.2 g in corners.');
  });
});
