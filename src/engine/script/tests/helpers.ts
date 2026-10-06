import type { Program } from '../ast';
import type { Diagnostic } from '../diagnostics';
import { parse } from '../parser';
import { check } from '../checker';

/** The tree as plain data with every source span removed, so trees from different texts compare equal. */
export function shape(program: Program): unknown {
  return JSON.parse(JSON.stringify(program, (key, value) => (key === 'span' || key.endsWith('Span') ? undefined : value)));
}

/** Parse and check diagnostics for a source, errors and warnings alike. */
export function problems(source: string): Diagnostic[] {
  const parsed = parse(source);
  return [...parsed.diagnostics, ...check(parsed.program).diagnostics];
}

export function errors(source: string): Diagnostic[] {
  return problems(source).filter((d) => d.severity === 'error');
}

/** Wraps lines in a racing script with one block, for short tests. */
export function inTick(lines: string, extra = ''): string {
  return `script "t" for racing v1\nbrain racing-standard\n${extra}\neach tick {\n${lines}\n}\n`;
}

export function inGeneration(lines: string): string {
  return `script "t" for racing v1\neach tick {\n  drive(steer: brain.steer, pedal: brain.pedal)\n}\n\neach generation {\n${lines}\n}\n`;
}
