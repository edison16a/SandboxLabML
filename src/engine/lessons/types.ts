import type { EnvId } from '../env/types';

/**
 * Lessons are JSON plus markdown under content/lessons/<course>/. Each lesson
 * has 3 to 6 steps; each step has a short text, a starter script, optional
 * highlights, a check, a hint ladder and a solution.
 */
export type LessonCheck =
  /** The script must contain these constructs (e.g. a reward that reads checkpoint.passed). */
  | { kind: 'astContains'; anyOf: AstPattern[]; message: string }
  /** One headless episode with a random or given brain must satisfy a metric comparison. */
  | { kind: 'testRun'; metric: string; op: '>' | '>=' | '<' | '<=' | '=='; value: number; message: string }
  /** Training for N generations must push a metric over a value. */
  | { kind: 'metricAbove'; generations: number; metric: string; value: number; message: string }
  /** The script compiles without errors (and optionally without warnings). */
  | { kind: 'compiles'; noWarnings?: boolean; message: string };

/** A small structural pattern matched against the script's syntax tree. */
export interface AstPattern {
  /** Statement kind: reward, stop, action call, operator call, sensor, let, if. */
  stmt: 'reward' | 'stop' | 'call' | 'sensor' | 'let' | 'if';
  /** Block the statement must live in. */
  scope?: 'tick' | 'generation' | 'top';
  /** Registry names the statement must reference, e.g. ["checkpoint.passed"]. */
  uses?: string[];
  /** For calls: the function name, e.g. "drive" or "speciate". */
  callee?: string;
}

export interface LessonStep {
  id: string;
  title: string;
  /** Markdown, a few short paragraphs at most. */
  body: string;
  starter: string;
  /** Lines (1-based) of the starter to highlight in the code view, and block ids in the blocks view. */
  highlight?: { lines?: number[] };
  check: LessonCheck;
  /** Hint 1, hint 2; the solution diff is the third rung. */
  hints: [string, string];
  solution: string;
}

export interface Lesson {
  id: string;
  course: EnvId;
  order: number;
  title: string;
  summary: string;
  minutes: number;
  steps: LessonStep[];
}

export interface CheckOutcome {
  passed: boolean;
  message: string;
  /** Measured value for metric checks, shown next to the target. */
  measured?: number;
}
