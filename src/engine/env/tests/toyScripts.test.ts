import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { evaluateCheck } from '../../lessons/evaluate';
import { linkScriptCompiler } from '../../lessons/compilerLink';
import { validateLesson } from '../../lessons/validate';
import type { Lesson } from '../../lessons/types';
import { neatConfig } from '../../neat/config';
import { snippetsFor } from '../../script/autocorrect';
import { compileScript } from '../../script/compiler';
import { parse } from '../../script/parser';
import { DEFAULT_SCRIPT_ENV, registerScriptEnv } from '../../script/envs';
import { hostFor } from '../../training/scriptHost';
import { registerEpisodeModule } from '../registry';
import { TOY_ENV, toyModule } from './toyEnv';
import { toyConfig, toyGeneration, toyTrainer } from './toyRun';
import { TOY_SCRIPT_ENV } from './toyScript';

let undo: Array<() => void> = [];
beforeAll(() => {
  undo = [registerEpisodeModule(toyModule), registerScriptEnv(TOY_SCRIPT_ENV)];
  linkScriptCompiler();
});
afterAll(() => undo.forEach((f) => f()));

const STARTER = TOY_SCRIPT_ENV.starter;
const ctx = (metrics: Record<string, number>) => ({ generation: 0, speciesCount: 1, bestFitness: 0, meanFitness: 0, stagnation: 0, metrics });

/** A run of `source`, with its compiled hash, the way the new run dialog stores a script. */
function scripted(source: string) {
  const { script } = compileScript(source);
  if (!script) throw new Error('The test script should compile.');
  return toyConfig(5, { source, hash: script.sourceHash, customSensors: script.sensors.length });
}

describe('scripts of an env added through the registry', () => {
  it('get snippets with their own names, and header help that lists them', () => {
    expect(snippetsFor('script', 'top', TOY_ENV)[0].template).toBe('script "${1:My script}" for ${2:toy} v1');
    expect(snippetsFor('brain', 'top', TOY_ENV)[0].template).toBe('brain ${1:toy-basic}');
    // No row templates: the plain blanks, never another env's sensors.
    expect(snippetsFor('stop', 'tick', TOY_ENV)[0].template).toBe('stop "${1:done}" when ${2:condition}');
    expect(snippetsFor('wal', 'tick', TOY_ENV).map((s) => s.label)).toEqual(['walk']);
    const bad = parse('script "x" for 3 v1\n').diagnostics.map((d) => d.message);
    expect(bad).toContain('Expected the environment name, racing or hideseek or toy.');
    // The missing header fix names the env the Studio offers first.
    expect(parse('brain toy-basic\n').diagnostics[0].fixes?.[0]).toMatchObject({ title: 'Add a script line', edits: [{ insert: `script "My script" for ${DEFAULT_SCRIPT_ENV} v1\n` }] });
  });

  it('compile against that env only', () => {
    expect(compileScript(STARTER).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(compileScript(STARTER.replace('stop "there" when walker.reached', 'stop "off" when car.offTrack')).script).toBeNull();
  });

  it('train under a tick block that reads extra from createController', () => {
    // Only walkers past half the goal score, which walker.goal can only know through extra.
    const source = 'script "Half" for toy v1\nbrain toy-basic\n\neach tick {\n  walk(move: brain.move)\n  reward 1 when walker.x > walker.goal / 2\n}\n';
    const t = toyTrainer(scripted(source));
    const record = toyGeneration(t);
    expect(record.champion.fitness).toBeGreaterThan(0);
    expect(record.champion.stopReason).toBe('time');
  });

  it('merge two operators into directives.env, read ctx.metrics and move the content on', () => {
    const source = `${STARTER}\neach generation {\n  if toy.reached > 0.5 {\n    toyLevel(value: 3)\n    toyPace(value: 2)\n  }\n}\n`;
    const host = hostFor(source);
    expect(host.runGeneration(ctx({ reachedShare: 0.7 }), new Rng(1), neatConfig()).env).toEqual({ level: 3, pace: 2 });
    expect(host.runGeneration(ctx({ reachedShare: 0.2 }), new Rng(1), neatConfig()).env).toBeUndefined();
    // In training the env's own generation metrics feed the block, and its request reaches nextContent.
    const t = toyTrainer(scripted(source));
    const level = () => (t.content as { level: number }).level;
    for (let g = 0; g < 8 && level() === 1; g++) toyGeneration(t);
    expect(level()).toBe(3);
  });
});

describe('lessons of an env added through the registry', () => {
  it('run a test run check with the env lesson brain', async () => {
    const passed = await evaluateCheck({ kind: 'testRun', metric: 'distance', op: '>', value: 1, message: 'Walk.' }, STARTER);
    expect(passed).toMatchObject({ passed: true });
    const unknown = await evaluateCheck({ kind: 'testRun', metric: 'laps', op: '>', value: 1, message: 'Walk.' }, STARTER);
    expect(unknown.message).toContain('Test walk cannot measure laps');
  });

  it('run a training check on a module metric', async () => {
    const outcome = await evaluateCheck({ kind: 'metricAbove', metric: 'reachedShare', generations: 2, value: 0.05, message: 'Reach.' }, STARTER);
    expect(outcome).toMatchObject({ passed: true });
  });

  it('validate lesson files against the module lesson info', () => {
    const step = (id: string, metric: string) => ({ id, title: 'Walk', body: 'Walk to the goal.', starter: STARTER, solution: STARTER, hints: ['Walk.', 'Walk on.'], check: { kind: 'testRun', metric, op: '>', value: 1, message: 'Walk.' } });
    const lesson = { id: 'toy-walk', course: 'toy', order: 1, title: 'Walk', summary: 'Walk to the goal.', minutes: 5, steps: [step('one', 'distance'), step('two', 'ticks'), step('three', 'laps')] } as unknown as Lesson;
    expect(validateLesson(lesson)).toEqual(['step 3 (three): a test walk cannot measure laps']);
  });
});
