import type { EnvId } from '../env/types';
import { MAX_CHECK_GENERATIONS } from './checks/metricAbove';
import { TEST_DRIVE_METRICS } from './checks/testRun';
import { HIDESEEK_TRAINING_METRICS, MAX_HIDESEEK_CHECK_GENERATIONS, TEST_MATCH_METRICS } from './hideseek/metrics';
import { scriptComments, styleProblems } from './style';
import { TRAINING_METRICS } from './training';
import type { AstPattern, Lesson, LessonCheck, LessonStep } from './types';

/** What each course's checks can measure, and how many generations its training checks may ask for. */
const MEASURES: Record<EnvId, { testRunName: string; testRun: readonly string[]; training: readonly string[]; maxGenerations: number }> = {
  racing: { testRunName: 'a test drive', testRun: TEST_DRIVE_METRICS, training: TRAINING_METRICS, maxGenerations: MAX_CHECK_GENERATIONS },
  hideseek: { testRunName: 'a test match', testRun: TEST_MATCH_METRICS, training: HIDESEEK_TRAINING_METRICS, maxGenerations: MAX_HIDESEEK_CHECK_GENERATIONS },
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OPS = ['>', '>=', '<', '<=', '=='];
const STMTS: AstPattern['stmt'][] = ['reward', 'stop', 'call', 'sensor', 'let', 'if'];
const SCOPES = ['tick', 'generation', 'top'];

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function patternProblems(p: AstPattern, where: string): string[] {
  const out: string[] = [];
  if (!STMTS.includes(p.stmt)) out.push(`${where}: unknown statement kind ${String(p.stmt)}`);
  if (p.scope !== undefined && !SCOPES.includes(p.scope)) out.push(`${where}: unknown scope ${String(p.scope)}`);
  if (p.uses !== undefined && (!Array.isArray(p.uses) || !p.uses.every(text))) out.push(`${where}: uses must be a list of names`);
  if (p.callee !== undefined && !text(p.callee)) out.push(`${where}: callee must be a name`);
  return out;
}

/** Shape problems of one check. Metric names are checked against what the course's checks can measure. */
function checkProblems(c: LessonCheck, where: string, course: EnvId): string[] {
  const out: string[] = [];
  const can = MEASURES[course] ?? MEASURES.racing;
  if (!text(c.message)) out.push(`${where}: check needs a message`);
  switch (c.kind) {
    case 'compiles':
      if (c.matchesPreset !== undefined && !text(c.matchesPreset)) out.push(`${where}: matchesPreset must be a preset id`);
      break;
    case 'astContains':
      if (!Array.isArray(c.anyOf) || c.anyOf.length === 0) out.push(`${where}: astContains needs at least one pattern`);
      else c.anyOf.forEach((p, i) => out.push(...patternProblems(p, `${where} pattern ${i + 1}`)));
      break;
    case 'testRun':
      if (!can.testRun.includes(c.metric)) out.push(`${where}: ${can.testRunName} cannot measure ${c.metric}`);
      if (!OPS.includes(c.op)) out.push(`${where}: unknown comparison ${c.op}`);
      if (!finite(c.value)) out.push(`${where}: value must be a number`);
      break;
    case 'metricAbove':
      if (!can.training.includes(c.metric)) out.push(`${where}: training cannot measure ${c.metric}`);
      if (!Number.isInteger(c.generations) || c.generations < 1 || c.generations > can.maxGenerations) {
        out.push(`${where}: generations must be a whole number from 1 to ${can.maxGenerations}`);
      }
      if (!finite(c.value)) out.push(`${where}: value must be a number`);
      break;
    default:
      out.push(`${where}: unknown check kind ${String((c as { kind?: unknown }).kind)}`);
  }
  return out;
}

function stepProblems(s: LessonStep, where: string, course: EnvId): string[] {
  const out: string[] = [];
  if (!text(s.id) || !KEBAB.test(s.id)) out.push(`${where}: id must be lowercase words joined by hyphens`);
  for (const field of ['title', 'body', 'starter', 'solution'] as const) if (!text(s[field])) out.push(`${where}: ${field} is empty`);
  if (!Array.isArray(s.hints) || s.hints.length !== 2 || !s.hints.every(text)) out.push(`${where}: needs exactly two hints`);
  const lineCount = text(s.starter) ? s.starter.split('\n').length : 0;
  for (const n of s.highlight?.lines ?? []) {
    if (!Number.isInteger(n) || n < 1 || n > lineCount) out.push(`${where}: highlighted line ${n} is not in the starter`);
  }
  if (s.check) out.push(...checkProblems(s.check, where, course));
  else out.push(`${where}: missing check`);
  return out;
}

/** Learner-facing text of a lesson, labeled so a style problem says where it is. */
function prose(lesson: Lesson): Array<[string, string]> {
  const out: Array<[string, string]> = [
    ['title', lesson.title],
    ['summary', lesson.summary],
  ];
  for (const s of lesson.steps ?? []) {
    out.push([`${s.id} title`, s.title], [`${s.id} body`, s.body], [`${s.id} check message`, s.check?.message ?? '']);
    (s.hints ?? []).forEach((h, i) => out.push([`${s.id} hint ${i + 1}`, h]));
    for (const c of [...scriptComments(s.starter ?? ''), ...scriptComments(s.solution ?? '')]) out.push([`${s.id} script comment`, c]);
  }
  return out;
}

/**
 * Light structural validation for lesson JSON, so a typo in content fails a
 * test instead of breaking Studio. It also enforces the course rules: 3 to
 * 6 steps, 5 to 10 minutes, and the project's writing style. Returns a list
 * of problems, empty when the lesson is fine. Whether checks pass is tested
 * separately, because that needs to run them.
 */
export function validateLesson(lesson: Lesson): string[] {
  const out: string[] = [];
  if (!text(lesson.id) || !KEBAB.test(lesson.id)) out.push('id must be lowercase words joined by hyphens');
  if (lesson.course !== 'racing' && lesson.course !== 'hideseek') out.push(`unknown course ${String(lesson.course)}`);
  if (!Number.isInteger(lesson.order) || lesson.order < 1) out.push('order must be a whole number from 1');
  if (!text(lesson.title) || !text(lesson.summary)) out.push('title and summary are required');
  if (!finite(lesson.minutes) || lesson.minutes < 5 || lesson.minutes > 10) out.push('minutes must be between 5 and 10');
  const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
  if (steps.length < 3 || steps.length > 6) out.push(`a lesson has 3 to 6 steps, this one has ${steps.length}`);
  const ids = new Set<string>();
  steps.forEach((s, i) => {
    if (ids.has(s.id)) out.push(`step ${i + 1}: duplicate id ${s.id}`);
    ids.add(s.id);
    out.push(...stepProblems(s, `step ${i + 1} (${s.id})`, lesson.course));
  });
  for (const [where, t] of prose(lesson)) for (const p of styleProblems(t)) out.push(`${where} ${p}`);
  return out;
}
