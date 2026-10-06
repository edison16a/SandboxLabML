import { describe, expect, it } from 'vitest';
import { hideSeekTier } from '@/features/hideseek/hooks/useHideSeekQuality';
import { gridCapped } from '@/features/hideseek/state/hideSeekStore';
import { fpsCap, parseQualityPin, qualityChosen, resolvedQuality, useSettings } from './settingsStore';

describe('resolvedQuality', () => {
  it('defaults by GPU when nothing is picked', () => {
    expect(resolvedQuality({ pinned: null, quality: null, weakGpu: false })).toBe('high');
    expect(resolvedQuality({ pinned: null, quality: null, weakGpu: true })).toBe('medium');
    // Before the probe runs, assume a discrete GPU.
    expect(resolvedQuality({ pinned: null, quality: null, weakGpu: null })).toBe('high');
  });

  it('prefers a pin from the address over a saved pick', () => {
    expect(resolvedQuality({ pinned: 'low', quality: 'high', weakGpu: false })).toBe('low');
    expect(resolvedQuality({ pinned: null, quality: 'low', weakGpu: false })).toBe('low');
  });
});

describe('gridCapped', () => {
  it('caps a weak GPU only until a quality is chosen', () => {
    expect(gridCapped({ weakGpu: true, quality: null, pinned: null })).toBe(true);
    expect(gridCapped({ weakGpu: true, quality: 'high', pinned: null })).toBe(false);
    expect(gridCapped({ weakGpu: true, quality: null, pinned: 'low' })).toBe(false);
    expect(gridCapped({ weakGpu: false, quality: null, pinned: null })).toBe(false);
    expect(qualityChosen({ quality: null, pinned: null })).toBe(false);
  });

  it('lifts the cap when the shown default is picked', () => {
    useSettings.setState({ weakGpu: true, quality: null, pinned: null });
    expect(resolvedQuality(useSettings.getState())).toBe('medium');
    expect(gridCapped(useSettings.getState())).toBe(true);
    useSettings.getState().setQuality('medium');
    expect(gridCapped(useSettings.getState())).toBe(false);
  });
});

describe('hideSeekTier', () => {
  it('keeps High at high and steps it up to ultra only in photo mode', () => {
    expect(hideSeekTier('high', false)).toBe('high');
    expect(hideSeekTier('high', true)).toBe('ultra');
    expect(hideSeekTier('medium', true)).toBe('medium');
    expect(hideSeekTier('ultra', false)).toBe('ultra');
  });
});

describe('settings store', () => {
  it('reads pins and caps', () => {
    expect(parseQualityPin('ultra')).toBe('ultra');
    expect(parseQualityPin('auto')).toBeNull();
    expect(parseQualityPin(null)).toBeNull();
    expect(fpsCap('30')).toBe(30);
    expect(fpsCap('max')).toBeNull();
  });

  it('drops a pin when a quality is picked, and works without storage', () => {
    const s = useSettings.getState();
    expect(s.frameRate).toBe('60');
    s.setPinned('low');
    s.setQuality('high');
    expect(useSettings.getState()).toMatchObject({ quality: 'high', pinned: null });
  });
});
