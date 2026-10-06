import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rng } from '../../core/rng';
import { fixAll } from '../autocorrect';
import { fromBlocks, toBlocks } from '../blocks';
import { compileScript } from '../compiler';
import { tokenize } from '../highlight';
import { parse } from '../parser';
import { SCRIPT_PRESETS } from '../presets/racing';
import { print } from '../printer';
import { inTick } from './helpers';
import { buildTrack } from '../../racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '../../racing/track/presets';

const oval = buildTrack(BUILT_IN_TRACKS[0]);

const VOCAB = [
  'script', 'for', 'racing', 'v1', 'brain', 'racing-starter', 'each', 'tick', 'generation', 'sensor', 'let', 'reward', 'stop', 'when',
  'if', 'else', 'repeat', 'in', 'and', 'or', 'not', 'true', 'false', 'car.speed', 'drive', 'rays', 'x', '(', ')', '{', '}', ',', ':', '.',
  '..', '+', '-', '*', '/', '%', '<', '>=', '==', '=', '!=', '1', '0.5', '5 s', '2 m/s2', '20%', '"crash"', '"open', '//c', '\n', '\n',
  '&&', '||', '!', ';', '[', ']', '`', '@', '#', 'é', '😀', '\\', "'", '1e999', 'constructor', '__proto__', 'speciate(target: 8)',
];

/** Runs every public entry point on a source. Each must return without throwing. */
function everything(source: string): void {
  tokenize(source);
  const parsed = parse(source);
  print(parsed.program);
  toBlocks(parsed.program);
  fromBlocks(toBlocks(parsed.program));
  const result = compileScript(source);
  if (result.script) result.script.createController({ seed: 1, track: oval });
}

describe('fuzzing', () => {
  it('random token soup never throws', () => {
    for (let seed = 0; seed < 400; seed++) {
      const rng = new Rng(seed);
      const parts = Array.from({ length: 5 + rng.int(150) }, () => rng.pick(VOCAB));
      const source = parts.join(rng.chance(0.5) ? ' ' : '');
      expect(() => everything(source), source).not.toThrow();
    }
  });

  it('every truncation of every preset never throws', () => {
    for (const p of SCRIPT_PRESETS) {
      for (let end = 0; end <= p.source.length; end += 5) {
        const source = p.source.slice(0, end);
        expect(() => everything(source), `${p.id} at ${end}`).not.toThrow();
      }
    }
  });

  it('fixAll terminates on broken input', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = new Rng(seed + 1000);
      const source = Array.from({ length: 40 }, () => rng.pick(VOCAB)).join(' ');
      expect(() => fixAll(source)).not.toThrow();
    }
  });
});

describe('deep nesting', () => {
  const cases: Array<[string, string]> = [
    ['parentheses', `${'('.repeat(5000)}1${')'.repeat(5000)}`],
    ['signs', `${'-'.repeat(5000)}1`],
    ['not', `${'not '.repeat(5000)}true`],
    ['long sum', `${'1 + '.repeat(5000)}1`],
    ['calls', `${'abs('.repeat(3000)}1${')'.repeat(3000)}`],
    ['records', `${'{ a: '.repeat(3000)}1${' }'.repeat(3000)}`],
  ];
  for (const [name, expr] of cases) {
    it(`reports ${name} nested thousands deep without throwing`, () => {
      const started = performance.now();
      const result = compileScript(inTick(`  reward ${expr}`));
      expect(result.script).toBeNull();
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
      expect(performance.now() - started).toBeLessThan(5000);
    });
  }

  it('reports blocks nested thousands deep without throwing', () => {
    const body = `${'if true {\n'.repeat(3000)}reward 1\n${'}\n'.repeat(3000)}`;
    const result = compileScript(inTick(body));
    expect(result.script).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain('too-deep');
  });
});

describe('JavaScript is refused', () => {
  afterEach(() => vi.unstubAllGlobals());

  const attempts = [
    'fetch("x")',
    'window.alert(1)',
    'constructor.constructor("return this")()',
    'eval("1 + 1")',
    'Function("return 1")()',
    'globalThis.process',
    '__proto__.polluted',
    'this.x',
    'import("x")',
    'require("fs")',
    'x => x',
    'alert`1`',
    '[1, 2].map(f)',
    'let a = 1; a++',
    'document.cookie = "a"',
    'localStorage.setItem("a", "b")',
  ];
  for (const attempt of attempts) {
    it(`refuses ${attempt}`, () => {
      const result = compileScript(inTick(`  drive(steer: 0, pedal: 0)\n  ${attempt}`));
      expect(result.script).toBeNull();
      expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });
  }

  it('never calls an unknown function, even when it exists in JavaScript', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = compileScript(inTick('  reward 1 when fetch("x") > 0'));
    expect(result.script).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain('not-allowed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the script package never evaluates generated code', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/\beval\s*\(|new Function\b|\bFunction\s*\(|setTimeout\s*\(\s*['"`]/);
    }
  });
});
