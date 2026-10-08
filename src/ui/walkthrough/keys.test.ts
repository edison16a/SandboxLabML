import { describe, expect, it } from 'vitest';
import { walkMove, type KeySpot } from './keys';

const free: KeySpot = { onControl: false, inArrowWidget: false, pageOwnsEscape: false };

describe('walkMove', () => {
  it('moves on with Right or Enter, back with Left and skips with Escape', () => {
    expect(walkMove('ArrowRight', free)).toBe('next');
    expect(walkMove('Enter', free)).toBe('next');
    expect(walkMove('ArrowLeft', free)).toBe('back');
    expect(walkMove('Escape', free)).toBe('skip');
  });

  it('leaves other keys to the lab, like Space and I that steps ask for', () => {
    expect(walkMove(' ', free)).toBeNull();
    expect(walkMove('i', free)).toBeNull();
  });

  it('lets Enter press a focused button instead of moving on', () => {
    expect(walkMove('Enter', { ...free, onControl: true })).toBeNull();
    expect(walkMove('ArrowRight', { ...free, onControl: true })).toBe('next');
  });

  it('leaves the arrows to a tab list or slider, so the keyboard can still reach the Network tab', () => {
    const tabs: KeySpot = { ...free, onControl: true, inArrowWidget: true };
    expect(walkMove('ArrowRight', tabs)).toBeNull();
    expect(walkMove('ArrowLeft', tabs)).toBeNull();
    expect(walkMove('Escape', tabs)).toBe('skip');
  });

  it('leaves Escape to the page while it has something to back out of, like a focused arena', () => {
    const backOut: KeySpot = { ...free, pageOwnsEscape: true };
    expect(walkMove('Escape', backOut)).toBeNull();
    expect(walkMove('ArrowRight', backOut)).toBe('next');
  });
});
