import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasFontFamily } from './canvasFont';

/** A page whose root carries the two variables next/font sets. */
function stubPage(vars: Record<string, string>): void {
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (name: string) => vars[name] ?? '' }));
}

describe('canvasFontFamily', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('spells out the family so a canvas never sees var()', () => {
    stubPage({ '--font-geist-sans': " 'GeistSans', 'GeistSans Fallback'", '--font-geist-mono': "'GeistMono'" });
    expect(canvasFontFamily('sans')).toBe("'GeistSans', 'GeistSans Fallback', sans-serif");
    expect(canvasFontFamily('mono')).toBe("'GeistMono', ui-monospace, monospace");
    expect(canvasFontFamily()).not.toContain('var(');
  });

  it('falls back to a plain family when the variable is missing or there is no page', () => {
    stubPage({});
    expect(canvasFontFamily('mono')).toBe('ui-monospace, monospace');
    vi.unstubAllGlobals();
    expect(canvasFontFamily('sans')).toBe('sans-serif');
  });
});
