import { describe, expect, it } from 'vitest';
import { RACING_PRESETS } from '@/engine/script';
import { choiceFromPreset } from './ScriptPicker';

describe('choiceFromPreset', () => {
  it('compiles every racing preset and finds its blueprint', () => {
    for (const p of RACING_PRESETS) {
      const c = choiceFromPreset(p);
      expect(c?.kind).toBe('script');
      if (c?.kind === 'script') {
        expect(c.compiled.hash).toMatch(/^[0-9a-f]{8}$/);
        expect(c.blueprint?.env).toBe('racing');
      }
    }
  });
});
