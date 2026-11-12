import { describe, expect, it } from 'vitest';
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

describe('qualityChosen', () => {
  it('is false until someone picks a quality or pins one', () => {
    expect(qualityChosen({ quality: null, pinned: null })).toBe(false);
    expect(qualityChosen({ quality: 'high', pinned: null })).toBe(true);
    expect(qualityChosen({ quality: null, pinned: 'low' })).toBe(true);
  });

  it('counts picking the shown default as a choice', () => {
    useSettings.setState({ weakGpu: true, quality: null, pinned: null });
    expect(resolvedQuality(useSettings.getState())).toBe('medium');
    expect(qualityChosen(useSettings.getState())).toBe(false);
    useSettings.getState().setQuality('medium');
    expect(qualityChosen(useSettings.getState())).toBe(true);
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
