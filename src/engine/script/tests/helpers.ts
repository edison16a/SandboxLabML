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

/** The line that makes an SUV follow its brain. */
export const DRIVE = 'drive(steer: brain.steer, pedal: brain.pedal)';

/** Wraps lines in a Driving script with one block, for short tests. */
export function inTick(lines: string, extra = ''): string {
  return `script "t" for driving v1\nbrain driving-standard\n${extra}\neach tick {\n${lines}\n}\n`;
}

export function inGeneration(lines: string): string {
  return `script "t" for driving v1\neach tick {\n  ${DRIVE}\n}\n\neach generation {\n${lines}\n}\n`;
}

/** The line that makes a Navigation runner follow its brain. */
export const NAVIGATION_ACT = 'act(move: brain.move, turn: brain.turn)';

/** Wraps lines in a Navigation script with one each tick block. */
export function inNavigationTick(lines: string): string {
  return `script "t" for navigation v1\nbrain navigation-standard\n\neach tick {\n  ${NAVIGATION_ACT}\n${lines}\n}\n`;
}

export function inNavigationGeneration(lines: string): string {
  return `script "t" for navigation v1\neach tick {\n  ${NAVIGATION_ACT}\n}\n\neach generation {\n${lines}\n}\n`;
}
