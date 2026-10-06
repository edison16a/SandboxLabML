import { describe, expect, it } from 'vitest';
import { FIXTURE_LESSON as lesson } from './fixtures/fixtureLesson';
import { lineDiff } from './lineDiff';
import { parseInline, parseMarkdown } from './markdown';
import { lessonFraction, openPlayer, reducePlayer } from './player';

describe('markdown subset', () => {
  it('parses paragraphs, lists, bold and inline code', () => {
    expect(parseMarkdown(lesson.steps[0].body)).toEqual([
      { kind: 'paragraph', inline: [{ kind: 'text', text: 'Cars only move when a script calls ' }, { kind: 'bold', children: [{ kind: 'text', text: 'drive' }] }, { kind: 'text', text: '.' }] },
      {
        kind: 'list',
        ordered: false,
        items: [
          [{ kind: 'text', text: 'Add ' }, { kind: 'code', text: 'drive(steer: brain.steer, pedal: brain.pedal)' }],
          [{ kind: 'text', text: 'Press ' }, { kind: 'bold', children: [{ kind: 'text', text: 'Check' }] }],
        ],
      },
    ]);
  });

  it('joins wrapped lines, numbers lists and keeps stray markers as text', () => {
    const blocks = parseMarkdown('One\ntwo\n\n1. first\n2. second');
    expect(blocks[0]).toEqual({ kind: 'paragraph', inline: [{ kind: 'text', text: 'One two' }] });
    expect(blocks[1]).toMatchObject({ kind: 'list', ordered: true });
    expect(parseInline('a ** b ` c')).toEqual([{ kind: 'text', text: 'a ** b ` c' }]);
    expect(parseInline('`**not bold**`')).toEqual([{ kind: 'code', text: '**not bold**' }]);
    expect(parseInline('<b>x</b>')).toEqual([{ kind: 'text', text: '<b>x</b>' }]);
  });
});

describe('line diff', () => {
  it('marks added and removed lines around common ones', () => {
    const d = lineDiff(lesson.steps[1].starter, lesson.steps[1].solution);
    expect(d.filter((l) => l.kind === 'add').map((l) => l.text.trim())).toEqual(['reward +1 when checkpoint.passed']);
    expect(d.filter((l) => l.kind === 'remove')).toEqual([]);
    expect(lineDiff('a\nb\n', 'a\nc\n')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'remove', text: 'b' },
      { kind: 'add', text: 'c' },
    ]);
  });
});

describe('lesson player', () => {
  it('unlocks steps in order and climbs the hint ladder per step', () => {
    let s = openPlayer(lesson);
    expect(reducePlayer(s, { type: 'goto', step: 1 }, lesson)).toBe(s);
    s = reducePlayer(s, { type: 'hint' }, lesson);
    s = reducePlayer(reducePlayer(reducePlayer(s, { type: 'hint' }, lesson), { type: 'hint' }, lesson), { type: 'hint' }, lesson);
    expect(s.hints).toBe(3);
    s = reducePlayer(s, { type: 'checkStart' }, lesson);
    s = reducePlayer(s, { type: 'checkProgress', fraction: 0.5 }, lesson);
    expect(s.check).toEqual({ status: 'running', progress: 0.5 });
    s = reducePlayer(s, { type: 'checkDone', outcome: { passed: false, message: 'no' } }, lesson);
    expect(s.unlocked).toBe(0);
    s = reducePlayer(s, { type: 'checkDone', outcome: { passed: true, message: 'yes' } }, lesson);
    expect(s.unlocked).toBe(1);
    s = reducePlayer(s, { type: 'goto', step: 1 }, lesson);
    expect(s).toMatchObject({ step: 1, hints: 0, check: { status: 'idle' } });
    s = reducePlayer(s, { type: 'checkDone', outcome: { passed: true, message: 'done' } }, lesson);
    expect(s.completed).toBe(true);
  });

  it('resumes from saved progress and reports how far along a lesson is', () => {
    expect(openPlayer(lesson, { step: 1, completed: false })).toMatchObject({ step: 1, unlocked: 1 });
    expect(openPlayer(lesson, { step: 9, completed: true }).step).toBe(1);
    expect(lessonFraction(lesson)).toBe(0);
    expect(lessonFraction(lesson, { step: 1, completed: false })).toBe(0.5);
    expect(lessonFraction(lesson, { step: 1, completed: true })).toBe(1);
  });
});
