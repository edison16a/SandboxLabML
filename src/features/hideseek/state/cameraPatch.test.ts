import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCamera, saveCamera } from './cameraPreference';
import { cameraPatch } from './hideSeekStore';

describe('camera choice', () => {
  const grid = { mode: 'train' as const, gridSize: 50 as const, focus: null };

  it('flies into the first arena when a view that rides on an agent is picked on the grid', () => {
    expect(cameraPatch(grid, 'follow-hider')).toEqual({ camera: 'follow-hider', focus: 0 });
    expect(cameraPatch(grid, 'seeker')).toEqual({ camera: 'seeker', focus: 0 });
    // Framing views keep the grid, and a focused arena or the Sandbox stays as it is.
    expect(cameraPatch(grid, 'overview')).toEqual({ camera: 'overview' });
    expect(cameraPatch({ ...grid, focus: 7 }, 'follow-seeker')).toEqual({ camera: 'follow-seeker' });
    expect(cameraPatch({ ...grid, mode: 'sandbox' }, 'follow-seeker')).toEqual({ camera: 'follow-seeker' });
  });

  describe('remembered view', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('remembers only the framing views', () => {
      const store = new Map<string, string>();
      vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
      saveCamera('free');
      saveCamera('follow-hider');
      expect(loadCamera()).toBe('free');
      store.set('sandboxlab.hideseek.camera', 'hider');
      expect(loadCamera()).toBeNull();
    });
  });
});
