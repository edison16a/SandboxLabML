import { describe, expect, it } from 'vitest';
import { presetsOf } from '@/engine/script';

const DRIVING_PRESETS = presetsOf('driving');
const NAVIGATION_PRESETS = presetsOf('navigation');
import { choiceFromPreset, choiceFromSource } from './scriptChoice';

describe('script choices', () => {
  it('compiles every preset and finds its blueprint', () => {
    expect(DRIVING_PRESETS.length).toBeGreaterThan(0);
    expect(NAVIGATION_PRESETS.length).toBeGreaterThan(0);
    for (const [env, presets] of [['driving', DRIVING_PRESETS], ['navigation', NAVIGATION_PRESETS]] as const) {
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
    expect(choiceFromSource('navigation', 'x', 'x', DRIVING_PRESETS[0].source)).toBeNull();
    expect(choiceFromSource('driving', 'x', 'x', NAVIGATION_PRESETS[0].source)).toBeNull();
  });
});
