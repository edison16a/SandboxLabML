import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { episodeEnvIds, isEpisodeEnv } from '@/engine/env/registry';
import { compileScript } from '@/engine/script/compiler';
import { SCRIPT_ENV_TABLE } from '@/engine/script/envs';
import { LABS } from './labs';

const ROOT = resolve(__dirname, '../../..');

/** Envs the engine still registers but no screen shows. Engine removal deletes their rows, and then this list. */
const RETIRED = ['racing'];

/**
 * A new env adds one entry per layer. These checks make the entries agree,
 * so a missing row fails here instead of quietly sending links to /runs or
 * scripts to an unknown env.
 */
describe('the per layer entries of every env', () => {
  it('give every registered env a script row and a lab row', () => {
    const scripted = SCRIPT_ENV_TABLE.map((row) => row.env);
    const labs = LABS.map((lab) => lab.env);
    for (const env of episodeEnvIds()) {
      expect(scripted, `${env} has no SCRIPT_ENV_TABLE row`).toContain(env);
      if (!RETIRED.includes(env)) expect(labs, `${env} has no LABS row`).toContain(env);
    }
  });

  it('show only Driving and Navigation, in that order', () => {
    expect(LABS.map((lab) => lab.env)).toEqual(['driving', 'navigation']);
    for (const env of RETIRED) expect(LABS.some((lab) => lab.env === env)).toBe(false);
  });

  it('keep every script row on its own slice, with a starter that compiles', () => {
    for (const row of SCRIPT_ENV_TABLE) {
      expect(row.slice.env, row.env).toBe(row.env);
      expect(isEpisodeEnv(row.env), row.env).toBe(true);
      const { script, diagnostics } = compileScript(row.starter);
      expect(diagnostics.filter((d) => d.severity === 'error'), row.env).toEqual([]);
      expect(script?.header.env, row.env).toBe(row.env);
    }
  });

  it('give every lab row a known env and a page', () => {
    for (const lab of LABS) {
      expect(isEpisodeEnv(lab.env), lab.env).toBe(true);
      expect(existsSync(resolve(ROOT, `app${lab.path}/page.tsx`)), lab.path).toBe(true);
    }
  });
});
