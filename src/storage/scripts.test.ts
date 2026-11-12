import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DRIVING_PRESETS } from '@/engine/script/presets/driving';
import { SandboxDb, setDb } from './db';
import { getLessonProgress, listLessonProgress, resetLessonProgress, saveLessonProgress } from './lessonProgress';
import {
  createScript,
  deleteScript,
  duplicateScript,
  envFromSource,
  getScript,
  HISTORY_LIMIT,
  listPresets,
  listScripts,
  renameScript,
  saveScript,
} from './scripts';

let n = 0;
beforeEach(() => setDb(new SandboxDb(`scripts-test-${n++}`)));

const src = (name: string, env = 'driving') => `script "${name}" for ${env} v1\n`;

describe('scripts repository', () => {
  it('creates, lists newest first and filters by env', async () => {
    const a = await createScript({ name: 'A', source: src('A') });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createScript({ name: 'B', source: src('B', 'navigation') });
    expect(a.env).toBe('driving');
    expect(b.env).toBe('navigation');
    expect((await listScripts()).map((s) => s.name)).toEqual(['B', 'A']);
    expect((await listScripts('driving')).map((s) => s.name)).toEqual(['A']);
  });

  it('keeps the last 20 versions, newest first, without duplicates', async () => {
    const s = await createScript({ name: 'H', source: src('v0') });
    for (let i = 1; i <= 25; i++) await saveScript(s.id, src(`v${i}`));
    await saveScript(s.id, src('v25'));
    const row = await getScript(s.id);
    expect(row?.source).toBe(src('v25'));
    expect(row?.history).toHaveLength(HISTORY_LIMIT);
    expect(row?.history[0].source).toBe(src('v25'));
    expect(row?.history[19].source).toBe(src('v6'));
  });

  it('renames, duplicates and deletes', async () => {
    const s = await createScript({ name: 'Old', source: src('x') });
    await renameScript(s.id, '  New  ');
    expect((await getScript(s.id))?.name).toBe('New');
    await expect(renameScript(s.id, ' ')).rejects.toThrow('needs a name');
    const copy = await duplicateScript(s.id);
    expect(copy.name).toBe('New copy');
    expect(copy.id).not.toBe(s.id);
    await deleteScript(s.id);
    expect(await getScript(s.id)).toBeUndefined();
    expect((await listScripts()).map((r) => r.id)).toEqual([copy.id]);
  });

  it('serves presets read only and duplicates them into editable copies', async () => {
    const presets = listPresets('driving');
    expect(presets.map((p) => p.id)).toEqual(DRIVING_PRESETS.map((p) => p.id));
    expect(presets.every((p) => p.readonly)).toBe(true);
    const beginner = await getScript('driving-beginner');
    expect(beginner?.readonly).toBe(true);
    await expect(saveScript('driving-beginner', 'x')).rejects.toThrow('read only');
    await expect(deleteScript('driving-beginner')).rejects.toThrow('read only');
    const copy = await duplicateScript('driving-beginner');
    expect(copy.readonly).toBe(false);
    expect(copy.source).toBe(beginner?.source);
    expect(copy.tier).toBe('custom');
  });

  it('reads the env from the header', () => {
    expect(envFromSource('// hi\nscript "x" for navigation v1')).toBe('navigation');
    expect(envFromSource('nothing here', 'navigation')).toBe('navigation');
    // A header naming a lab this version does not have reads as no header.
    expect(envFromSource('script "x" for hideseek v1', 'navigation')).toBe('navigation');
  });
});

describe('lesson progress', () => {
  it('only moves forward and keeps completion', async () => {
    await saveLessonProgress('l1', { step: 2, source: 'a' });
    await saveLessonProgress('l1', { step: 1 });
    expect(await getLessonProgress('l1')).toMatchObject({ step: 2, source: 'a', completed: false });
    await saveLessonProgress('l1', { completed: true });
    await saveLessonProgress('l1', { step: 3 });
    expect((await listLessonProgress()).get('l1')).toMatchObject({ step: 3, completed: true });
    await resetLessonProgress('l1');
    expect(await getLessonProgress('l1')).toBeUndefined();
  });
});
