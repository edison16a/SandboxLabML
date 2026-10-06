import { describe, expect, it } from 'vitest';
import { RADAR_AXES, radarValues } from '../radar';

describe('radarValues', () => {
  it('keeps the Racing axes in their original order', () => {
    const values = radarValues('racing', { speed: 0.1, completion: 0.2, smoothness: 0.3, generalization: 0.4 });
    expect(values.map((v) => v.label)).toEqual(['Speed', 'Completion', 'Smoothness', 'Generalization']);
    expect(values.map((v) => v.value)).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('gives Hide and Seek its own axes and reads a missing one as 0', () => {
    const values = radarValues('hideseek', { hiding: 0.5, seeking: 0.25, cover: 0.75, generalization: 0.1 });
    expect(values.map((v) => v.key)).toEqual(RADAR_AXES.hideseek.map((a) => a.key));
    expect(values.find((v) => v.key === 'cover')?.value).toBe(0.75);
    expect(radarValues('hideseek', { speed: 1, completion: 1, smoothness: 1, generalization: 1 }).find((v) => v.key === 'hiding')?.value).toBe(0);
  });
});
