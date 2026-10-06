import { emptyTrivia, type BrainDecl, type EachItem, type EventName, type Header, type Item, type Program, type SensorItem } from './ast';
import { bestSuggestion } from './autocorrect/suggest';
import { insertFix, makeDiagnostic, replaceFix, sortDiagnostics, type Diagnostic } from './diagnostics';
import { lex, type Token } from './lexer';
import { Cursor } from './parse/cursor';
import { parseExpr } from './parse/expr';
import { eatWord, keywordTypo, parseLine, tokenSpan } from './parse/lines';
import { parseBlock, parseLet } from './parse/stmt';

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}

const ITEM_WORDS = ['let', 'sensor', 'each'];
const BLOCK_ONLY = new Set(['reward', 'stop', 'if', 'repeat', 'for', 'else']);
export const DEFAULT_HEADER = 'script "My script" for racing v1';

export function emptyProgram(): Program {
  return { header: null, brain: null, items: [], dangling: [] };
}

/**
 * Parses a whole script. Never throws and never gives up early: syntax
 * errors become diagnostics, the broken line is skipped, and the rest of the
 * script still produces a tree so the editor can keep checking it.
 */
export function parse(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  try {
    const lexed = lex(source);
    diagnostics.push(...lexed.diagnostics);
    const c = new Cursor(source, lexed.tokens, lexed.comments, diagnostics);
    return { program: parseProgram(c), diagnostics: sortDiagnostics(diagnostics) };
  } catch {
    // Only reachable through an engine fault such as running out of stack. Report it, do not crash the editor.
    diagnostics.push(makeDiagnostic('error', 'internal', 'This script could not be read. Try undoing the last change.', { from: 0, to: 0 }));
    return { program: emptyProgram(), diagnostics: sortDiagnostics(diagnostics) };
  }
}

function parseProgram(c: Cursor): Program {
  const program = emptyProgram();
  const first = c.peek();
  if ((first.kind === 'keyword' && first.text === 'script') || (first.kind === 'ident' && bestSuggestion(first.text, ['script']) === 'script')) {
    program.header = parseLine(c, true, true, () => parseHeader(c));
  } else {
    c.error(`Start the script with a line like: ${DEFAULT_HEADER}`, { from: 0, to: 0 }, 'missing-header', [
      insertFix('Add a script line', 0, `${DEFAULT_HEADER}\n`),
    ]);
  }
  while (!c.done) {
    const t = c.peek();
    if (t.kind === 'punct' && t.text === '}') {
      c.error('This } has no matching {.', tokenSpan(t), 'stray-brace', [replaceFix('Remove the }', t, '')]);
      c.next();
      continue;
    }
    if (t.kind === 'ident' && t.text === 'brain' && !c.isPunct('.', 1)) {
      const b = parseLine(c, true, true, () => parseBrain(c));
      if (!b) continue;
      b.blankBefore = false;
      if (program.brain) c.error('A script has one brain line.', b.span, 'duplicate-brain');
      else if (program.items.length > 0) c.error('Put the brain line right after the script line.', b.span, 'brain-position');
      program.brain = b;
      continue;
    }
    const before = program.header !== null || program.brain !== null || program.items.length > 0;
    const item = parseLine(c, !before, true, () => parseItem(c));
    if (!item) continue;
    // Canonical layout: a blank line always separates each blocks from what comes before.
    if (item.kind === 'each' && before) item.blankBefore = true;
    program.items.push(item);
  }
  program.dangling = c.claim(Infinity);
  return program;
}

function parseHeader(c: Cursor): Header {
  const kw = c.next();
  if (kw.kind === 'ident') keywordTypo(c, kw, ['script']);
  const name = c.peek();
  if (name.kind !== 'string') c.fail(`Give the script a name in quotes, like ${DEFAULT_HEADER}`, c.spanHere(), 'bad-header');
  c.next();
  if (!eatWord(c, 'for')) c.fail('Expected for and the environment, like for racing.', c.spanHere(), 'bad-header');
  const env = c.expect('ident', undefined, 'Expected the environment name, racing or hideseek.');
  const v = c.peek();
  const m = v.kind === 'ident' && v.line === env.line ? /^v(\d+)$/.exec(v.text) : null;
  if (!m) c.fail('Expected the script version, like v1.', c.spanHere(), 'bad-header', [insertFix('Add v1', env.to, ' v1')]);
  c.next();
  return {
    name: String(name.value ?? ''),
    env: env.text,
    envSpan: tokenSpan(env),
    version: Number(m[1]),
    span: { from: kw.from, to: v.to },
    ...emptyTrivia(),
  };
}

const isIdPart = (t: Token) => t.kind === 'ident' || t.kind === 'number' || t.kind === 'unit' || t.kind === 'keyword' || (t.kind === 'op' && t.text === '-');

/** `brain racing-starter`. The id is glued back together from touching tokens, since `-` is also minus. */
function parseBrain(c: Cursor): BrainDecl {
  const kw = c.next();
  const first = c.peek();
  if (first.kind !== 'ident' || first.line !== kw.line) c.fail('Expected a brain id after brain, like brain racing-starter.', c.spanHere(), 'expected-brain');
  let id = '';
  let to = first.from;
  while (isIdPart(c.peek()) && (id === '' || c.peek().from === to)) {
    const t = c.next();
    id += t.text;
    to = t.to;
  }
  return { id, idSpan: { from: first.from, to }, span: { from: kw.from, to }, ...emptyTrivia() };
}

function parseItem(c: Cursor): Item {
  const t = c.peek();
  let word = t.kind === 'keyword' ? t.text : null;
  if (t.kind === 'ident' && !c.isPunct('(', 1) && !c.isPunct('.', 1)) word = keywordTypo(c, t, ITEM_WORDS);
  if (word === 'let') return parseLet(c);
  if (word === 'sensor') return parseSensor(c);
  if (word === 'each') return parseEach(c);
  if (word === 'script') c.fail('The script line can only appear once, at the very top.', tokenSpan(t), 'duplicate-header');
  if (t.kind === 'ident' || (t.kind === 'keyword' && BLOCK_ONLY.has(t.text))) {
    c.fail('Put this inside an each tick or each generation block.', tokenSpan(t), 'outside-block');
  }
  return c.fail('Expected sensor, let or each here.', tokenSpan(t), 'expected-item');
}

function parseSensor(c: Cursor): SensorItem {
  const kw = c.next();
  const name = c.expect('ident', undefined, 'Expected a sensor name, like sensor gap "Gap ahead" in 0 m .. 60 m = rays.min.');
  const label = c.peek();
  if (label.kind !== 'string') c.fail('Give the sensor a label in quotes, like "Gap ahead".', c.spanHere(), 'expected-label');
  c.next();
  if (!eatWord(c, 'in')) c.fail('Expected in and a range, like in 0 m .. 60 m.', c.spanHere(), 'expected-range');
  const lo = parseExpr(c);
  c.expect('op', '..', 'Expected .. between the low and high ends of the range.');
  c.allowAssign = true;
  let hi;
  try {
    hi = parseExpr(c);
  } finally {
    c.allowAssign = false;
  }
  c.expect('op', '=', 'Expected = and the value to sense, like = rays.min.');
  const value = parseExpr(c);
  return {
    kind: 'sensor',
    name: name.text,
    nameSpan: tokenSpan(name),
    label: String(label.value ?? ''),
    lo,
    hi,
    value,
    span: { from: kw.from, to: value.span.to },
    ...emptyTrivia(),
  };
}

function parseEach(c: Cursor): EachItem {
  const kw = c.next();
  const ev = c.peek();
  let event: string | null = null;
  if (ev.kind === 'ident' && (ev.text === 'tick' || ev.text === 'generation')) event = ev.text;
  else if (ev.kind === 'ident') event = keywordTypo(c, ev, ['tick', 'generation']);
  if (!event) c.fail('Expected tick or generation after each.', c.spanHere(), 'expected-event');
  c.next();
  c.hoisted.push(...c.claim(c.peek().from));
  const body = parseBlock(c);
  return { kind: 'each', event: event as EventName, body, span: { from: kw.from, to: body.span.to }, ...emptyTrivia() };
}
