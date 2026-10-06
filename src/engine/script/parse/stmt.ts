import { emptyTrivia, type Block, type ForEachStmt, type IfStmt, type LetStmt, type RepeatStmt, type Stmt } from '../ast';
import { bestSuggestion } from '../autocorrect/suggest';
import { insertFix, lineOf, replaceFix } from '../diagnostics';
import type { Cursor } from './cursor';
import { parseExpr } from './expr';
import { eatWord, keywordTypo, lineEnd, parseLine, tokenSpan } from './lines';

const STATEMENT_WORDS = ['let', 'reward', 'stop', 'if', 'repeat', 'for'];

/** Top-level words that cannot appear inside a block. Seeing one means a `}` is missing. */
function startsTopLevel(c: Cursor): boolean {
  return c.isKeyword('each') || c.isKeyword('sensor') || c.isKeyword('script');
}

export function parseBlock(c: Cursor): Block {
  const open = c.expect('punct', '{', 'Expected { to start a block.');
  c.enter(open);
  const openComment = c.trailingAfter(open);
  const stmts: Stmt[] = [];
  for (;;) {
    const t = c.peek();
    if (t.kind === 'punct' && t.text === '}') {
      const dangling = c.claim(t.from);
      c.next();
      c.leave();
      return { stmts, openComment, dangling, span: { from: open.from, to: t.to } };
    }
    if (t.kind === 'eof' || startsTopLevel(c)) {
      const at = lineEnd(c.source, c.prev().to);
      c.error(`Missing } to close the block opened on line ${lineOf(c.source, open.from)}.`, tokenSpan(open), 'missing-brace', [
        insertFix('Add the missing }', at, '\n}'),
      ]);
      const dangling = t.kind === 'eof' ? c.claim(t.from) : [];
      c.leave();
      return { stmts, openComment, dangling, span: { from: open.from, to: c.prev().to } };
    }
    const s = parseLine(c, stmts.length === 0, false, () => parseStatement(c));
    if (s) stmts.push(s);
  }
}

/** Claims comments sitting between a statement head and its `{`, then parses the block. */
function blockAfterHead(c: Cursor): Block {
  c.hoisted.push(...c.claim(c.peek().from));
  return parseBlock(c);
}

function parseStatement(c: Cursor): Stmt {
  const t = c.peek();
  let word = t.kind === 'keyword' ? t.text : null;
  if (t.kind === 'ident' && !c.isPunct('(', 1) && !c.isPunct('.', 1)) word = keywordTypo(c, t, STATEMENT_WORDS);
  switch (word) {
    case 'let':
      return parseLet(c);
    case 'reward':
      return parseReward(c);
    case 'stop':
      return parseStop(c);
    case 'if':
      return parseIf(c);
    case 'repeat':
      return parseRepeat(c);
    case 'for':
      return parseForEach(c);
  }
  if (t.kind === 'ident') {
    const expr = parseExpr(c);
    return { kind: 'expr', expr, span: expr.span, ...emptyTrivia() };
  }
  if (t.kind === 'keyword' && t.text === 'else') c.fail('This else has no if block right before it.', tokenSpan(t), 'stray-else');
  const what = t.kind === 'invalid' ? `the character ${t.text}` : t.text;
  return c.fail(`A line cannot start with ${what}. Start it with reward, stop, let, if, repeat, for or an action such as drive(...).`, tokenSpan(t), 'expected-statement');
}

export function parseLet(c: Cursor): LetStmt {
  const kw = c.next();
  const name = c.peek();
  if (name.kind !== 'ident') c.fail('Expected a name after let, like let gap = 2 m.', c.spanHere(), 'expected-name');
  c.next();
  if (c.is('op', '==')) {
    const eq = c.next();
    c.error('Use a single = to name a value.', tokenSpan(eq), 'eq-typo', [replaceFix('Change == to =', eq, '=')]);
  } else {
    c.expect('op', '=', `Expected = after ${name.text}.`, [insertFix('Add =', name.to, ' =')]);
  }
  const value = parseExpr(c);
  return { kind: 'let', name: name.text, nameSpan: tokenSpan(name), value, span: { from: kw.from, to: value.span.to }, ...emptyTrivia() };
}

function parseReward(c: Cursor): Stmt {
  const kw = c.next();
  const value = parseExpr(c);
  const when = eatWord(c, 'when') ? parseExpr(c) : null;
  return { kind: 'reward', value, when, span: { from: kw.from, to: c.prev().to }, ...emptyTrivia() };
}

function parseStop(c: Cursor): Stmt {
  const kw = c.next();
  const r = c.peek();
  let reason = '';
  if (r.kind === 'string') {
    reason = String(r.value ?? '');
  } else if (r.kind === 'ident' && r.line === kw.line) {
    reason = r.text;
    c.error('Put the stop reason in quotes.', tokenSpan(r), 'unquoted-reason', [replaceFix(`Change to "${r.text}"`, r, `"${r.text}"`)]);
  } else {
    c.fail('Give the stop a reason in quotes, like stop "crash" when car.offTrack.', c.spanHere(), 'expected-reason');
  }
  c.next();
  if (!eatWord(c, 'when')) {
    c.fail('A stop needs a condition. Add when and a test, like when car.offTrack.', c.spanHere(), 'expected-when');
  }
  const when = parseExpr(c);
  return { kind: 'stop', reason, reasonSpan: tokenSpan(r), when, span: { from: kw.from, to: when.span.to }, ...emptyTrivia() };
}

function parseIf(c: Cursor): IfStmt {
  const kw = c.next();
  const cond = parseExpr(c);
  const then = blockAfterHead(c);
  let otherwise: Block | IfStmt | null = null;
  if (eatElse(c)) {
    if (c.isKeyword('if')) otherwise = parseIf(c);
    else otherwise = blockAfterHead(c);
  }
  return { kind: 'if', cond, then, else: otherwise, span: { from: kw.from, to: c.prev().to }, ...emptyTrivia() };
}

/** `else`, or a near miss like `esle` when a `{` or `if` follows it. */
function eatElse(c: Cursor): boolean {
  const t = c.peek();
  const typo = t.kind === 'ident' && (c.isPunct('{', 1) || c.isKeyword('if', 1)) && bestSuggestion(t.text, ['else']) === 'else';
  if (!typo && !(t.kind === 'keyword' && t.text === 'else')) return false;
  // Comments between the closing } and else move up to the if statement.
  c.hoisted.push(...c.claim(t.from));
  if (typo) keywordTypo(c, t, ['else']);
  c.next();
  return true;
}

function parseRepeat(c: Cursor): RepeatStmt {
  const kw = c.next();
  const n = c.peek();
  if (n.kind !== 'number' || c.is('unit', undefined, 1)) {
    c.fail('repeat needs a whole number of times without a unit, like repeat 3 { ... }.', c.spanHere(), 'expected-count');
  }
  c.next();
  const body = blockAfterHead(c);
  return { kind: 'repeat', count: Number(n.value ?? 0), countSpan: tokenSpan(n), body, span: { from: kw.from, to: body.span.to }, ...emptyTrivia() };
}

function parseForEach(c: Cursor): ForEachStmt {
  const kw = c.next();
  if (!eatWord(c, 'each')) c.fail('Write for each, like for each r in rays { ... }.', c.spanHere(), 'expected-each');
  const v = c.expect('ident', undefined, 'Expected a name for each item, like r in for each r in rays.');
  if (!eatWord(c, 'in')) c.fail(`Expected in after ${v.text}, like for each ${v.text} in rays.`, c.spanHere(), 'expected-in');
  const coll = c.expect('ident', undefined, 'Expected the name of a list, like rays.');
  const body = blockAfterHead(c);
  return {
    kind: 'forEach',
    variable: v.text,
    variableSpan: tokenSpan(v),
    collection: coll.text,
    collectionSpan: tokenSpan(coll),
    body,
    span: { from: kw.from, to: body.span.to },
    ...emptyTrivia(),
  };
}
