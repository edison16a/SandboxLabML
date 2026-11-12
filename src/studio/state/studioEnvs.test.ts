import { describe, expect, it } from 'vitest';
import { findScriptPreset } from '@/engine/script';
import { analyze } from '../doc/analyze';
import { shownScript, STARTER_SCRIPT_ID, STUDIO_DEFAULT_ENV, studioEnvOf, studioEnvs } from './studioEnvs';

describe('the Studio envs', () => {
  it('offer only Driving and Navigation, Driving first', () => {
    expect(studioEnvs().map((e) => e.env)).toEqual(['driving', 'navigation']);
    expect(STUDIO_DEFAULT_ENV).toBe('driving');
    expect(studioEnvOf(null)).toBe('driving');
    expect(studioEnvOf('navigation')).toBe('navigation');
  });

  it('start a newcomer on the Driving Beginner preset, which checks clean', () => {
    const preset = findScriptPreset(STARTER_SCRIPT_ID);
    expect(preset?.env).toBe('driving');
    expect(preset?.tier).toBe('beginner');
    expect(analyze(preset!.source).counts.error).toBe(0);
  });

  it('hide scripts and presets of removed labs', () => {
    expect(shownScript({ env: 'driving' })).toBe(true);
    expect(shownScript({ env: 'navigation' })).toBe(true);
    expect(shownScript({ env: 'racing' })).toBe(false);
    expect(shownScript({ env: 'hideseek' })).toBe(false);
  });
});

describe('a script header for a removed lab', () => {
  it('is an unknown env that names the labs, and the script reads as having no env', () => {
    const a = analyze('script "Old" for racing v1\n\neach tick {\n}\n');
    const d = a.diagnostics.find((x) => x.code === 'unknown-env');
    expect(d?.severity).toBe('error');
    expect(d?.message).toBe('There is no environment called racing. Use driving or navigation.');
    expect(a.env).toBeNull();
  });

  it('suggests only the labs for a misspelled env', () => {
    const a = analyze('script "Typo" for drivng v1\n');
    const d = a.diagnostics.find((x) => x.code === 'unknown-env');
    expect(d?.message).toBe('There is no environment called drivng. Did you mean driving?');
    const far = analyze('script "Far" for zzz v1\n').diagnostics.find((x) => x.code === 'unknown-env');
    expect(far?.message).toBe('There is no environment called zzz. Use driving or navigation.');
  });
});
