import { describe, expect, it } from 'vitest';
import { HIDESEEK_PRESETS, RACING_PRESETS } from '@/engine/script';
import { choiceFromPreset, choiceFromSource } from './scriptChoice';

describe('script choices', () => {
  it('compiles every preset and finds its blueprint', () => {
    for (const [env, presets] of [['racing', RACING_PRESETS], ['hideseek', HIDESEEK_PRESETS]] as const) {
      for (const p of presets) {
        const c = choiceFromPreset(env, p);
        expect(c?.kind, p.id).toBe('script');
        if (c?.kind === 'script') {
          expect(c.compiled.hash).toMatch(/^[0-9a-f]{8}$/);
          expect(c.blueprint?.env).toBe(env);
        }
      }
    }
  });

  it('refuses a script written for the other environment', () => {
    expect(choiceFromSource('hideseek', 'x', 'x', RACING_PRESETS[0].source)).toBeNull();
    expect(choiceFromSource('racing', 'x', 'x', HIDESEEK_PRESETS[0].source)).toBeNull();
  });
});
