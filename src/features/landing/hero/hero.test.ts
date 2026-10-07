import { describe, expect, it } from 'vitest';
import { heroMode, heroTier, LIVE_MIN_HEIGHT, LIVE_MIN_WIDTH, PHONE_SCREEN_SHORT, type HeroFacts } from './heroMode';
import { firstScene, nextScene } from './sceneCycle';

const desktop: HeroFacts = { reducedMotion: false, saveData: false, width: 1600, height: 1000, coarsePointer: false, screenShort: 1080, cores: 8, memoryGb: 8, webgl2: true };

describe('heroMode', () => {
  it('goes live on a capable desktop, including one that hides its memory and cores', () => {
    expect(heroMode(desktop)).toBe('live');
    expect(heroMode({ ...desktop, cores: 0, memoryGb: null })).toBe('live');
  });

  it('keeps the poster for reduced motion, saved data or no WebGL 2', () => {
    expect(heroMode({ ...desktop, reducedMotion: true })).toBe('poster');
    expect(heroMode({ ...desktop, saveData: true })).toBe('poster');
    expect(heroMode({ ...desktop, webgl2: false })).toBe('poster');
  });

  it('keeps the poster on phones and small machines', () => {
    expect(heroMode({ ...desktop, width: 390 })).toBe('poster');
    expect(heroMode({ ...desktop, width: LIVE_MIN_WIDTH - 1 })).toBe('poster');
    expect(heroMode({ ...desktop, width: LIVE_MIN_WIDTH })).toBe('live');
    expect(heroMode({ ...desktop, cores: 2 })).toBe('poster');
    expect(heroMode({ ...desktop, memoryGb: 2 })).toBe('poster');
  });

  it('keeps the poster where the brain card has no room beside the text', () => {
    // A portrait tablet, and a short laptop window.
    expect(heroMode({ ...desktop, width: 820, height: 1180 })).toBe('poster');
    expect(heroMode({ ...desktop, height: LIVE_MIN_HEIGHT - 1 })).toBe('poster');
    expect(heroMode({ ...desktop, width: LIVE_MIN_WIDTH, height: LIVE_MIN_HEIGHT })).toBe('live');
  });

  it('keeps the poster on a phone held sideways, however wide its window', () => {
    const sideways = { ...desktop, width: 932, coarsePointer: true, screenShort: 430 };
    expect(heroMode(sideways)).toBe('poster');
    expect(heroMode({ ...sideways, width: 1280 })).toBe('poster');
  });

  it('tells phones by touch and screen size together', () => {
    // A tablet's screen is wide both ways, and a zoomed in desktop reports a small screen but a fine pointer.
    expect(heroMode({ ...desktop, width: 1180, height: 740, coarsePointer: true, screenShort: 820 })).toBe('live');
    expect(heroMode({ ...desktop, coarsePointer: false, screenShort: 540 })).toBe('live');
    expect(heroMode({ ...desktop, coarsePointer: true, screenShort: PHONE_SCREEN_SHORT - 1 })).toBe('poster');
  });

  it('draws at the quality from Settings, stopping at High', () => {
    expect(heroTier('low', true, false)).toBe('low');
    expect(heroTier('medium', true, true)).toBe('medium');
    expect(heroTier('high', true, true)).toBe('high');
    expect(heroTier('ultra', true, false)).toBe('high');
  });

  it('starts a step below the labs when nobody picked a quality', () => {
    expect(heroTier('high', false, false)).toBe('medium');
    expect(heroTier('medium', false, true)).toBe('low');
  });
});

describe('scene cycle', () => {
  it('takes turns once both scenes are ready', () => {
    const both = { car: true, arena: true };
    expect(nextScene('car', both)).toBe('arena');
    expect(nextScene('arena', both)).toBe('car');
  });

  it('stays on the one scene that loaded', () => {
    expect(nextScene('car', { car: true, arena: false })).toBe('car');
    expect(nextScene('arena', { car: false, arena: true })).toBe('arena');
  });

  it('leaves a scene that is not ready for one that is, and waits when neither is', () => {
    expect(nextScene('car', { car: false, arena: true })).toBe('arena');
    expect(nextScene('car', { car: false, arena: false })).toBe('car');
    expect(firstScene({ car: false, arena: true })).toBe('arena');
    expect(firstScene({ car: true, arena: true })).toBe('car');
    expect(firstScene({ car: false, arena: false })).toBe('car');
  });
});
