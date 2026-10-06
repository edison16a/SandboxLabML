import type { Arg, Expr, NumberExpr, RecordExpr } from '../ast';
import { insertFix, replaceFix, type Span } from '../diagnostics';
import { UNIT_ALIASES, type UnitName } from '../units';
import type { Cursor } from './cursor';

type SubParser = (c: Cursor) => Expr;

const span = (from: number, to: number): Span => ({ from, to });

/**
 * Names, literals, calls and parentheses. The full expression parser comes
 * in as `sub` so this file and expr.ts do not import each other.
 */
export function parsePostfix(c: Cursor, sub: SubParser): Expr {
  let e = parsePrimary(c, sub);
  for (;;) {
    if (c.isPunct('.')) {
      const dot = c.next();
      const part = c.peek();
      if (part.kind !== 'ident') c.fail('Expected a name after the dot.', c.spanHere());
      if (e.kind !== 'name') c.fail('Only names can have a part after a dot, like car.speed.', dot);
      c.next();
      e = { kind: 'name', path: [...e.path, part.text], span: span(e.span.from, part.to) };
    } else if (c.isPunct('(')) {
      const { args, end } = parseArgs(c, sub);
      e = { kind: 'call', callee: e, args, span: span(e.span.from, end) };
    } else {
      return e;
    }
  }
}

/** `( arg, arg )`. A missing `)` gets a fix that adds it after the last argument. */
function parseArgs(c: Cursor, sub: SubParser): { args: Arg[]; end: number } {
  const open = c.next();
  c.enter(open);
  const args: Arg[] = [];
  while (!c.isPunct(')')) {
    if (c.done || c.isPunct('}')) break;
    args.push(parseArg(c, sub));
    if (!c.eat('punct', ',')) break;
  }
  const close = c.expect('punct', ')', 'Missing ) to close this call.', [insertFix('Add )', c.prev().to, ')')]);
  c.leave();
  return { args, end: close.to };
}

/** `name: value`, or a bare value for positional arguments such as `abs(x)`. */
function parseArg(c: Cursor, sub: SubParser): Arg {
  if (c.is('ident') && c.isPunct(':', 1)) {
    const name = c.next();
    c.next();
    const value = sub(c);
    return { name: name.text, value, span: span(name.from, value.span.to) };
  }
  const value = sub(c);
  return { name: null, value, span: value.span };
}

function parsePrimary(c: Cursor, sub: SubParser): Expr {
  const t = c.peek();
  if (t.kind === 'number') return parseNumber(c);
  if (t.kind === 'string') {
    c.next();
    return { kind: 'string', value: String(t.value ?? ''), span: span(t.from, t.to) };
  }
  if (t.kind === 'keyword' && (t.text === 'true' || t.text === 'false')) {
    c.next();
    return { kind: 'bool', value: t.text === 'true', span: span(t.from, t.to) };
  }
  if (t.kind === 'ident') {
    c.next();
    return { kind: 'name', path: [t.text], span: span(t.from, t.to) };
  }
  if (t.kind === 'punct' && t.text === '(') {
    c.next();
    c.enter(t);
    const inner = sub(c);
    c.expect('punct', ')', 'Missing ) to close the parenthesis.', [insertFix('Add )', c.prev().to, ')')]);
    c.leave();
    return inner;
  }
  if (t.kind === 'punct' && t.text === '{' && (c.isPunct('}', 1) || (c.is('ident', undefined, 1) && c.isPunct(':', 2)))) {
    return parseRecord(c, sub);
  }
  const what = t.kind === 'eof' ? 'the end of the script' : t.text;
  return c.fail(`Expected a value here, found ${what}.`, c.spanHere(), 'expected-value');
}

/** A number and its unit. A unit spelled out in words (`5 seconds`) is reported with a fix and accepted. */
function parseNumber(c: Cursor): NumberExpr {
  const t = c.next();
  let unit: UnitName = '';
  let to = t.to;
  const u = c.peek();
  if (u.kind === 'unit') {
    c.next();
    unit = u.value as UnitName;
    to = u.to;
  } else if (u.kind === 'ident' && u.line === t.line && UNIT_ALIASES.has(u.text.toLowerCase())) {
    unit = UNIT_ALIASES.get(u.text.toLowerCase()) as UnitName;
    c.error(`Write the unit as ${unit}.`, u, 'unit-spelling', [replaceFix(`Change ${u.text} to ${unit}`, u, unit)]);
    c.next();
    to = u.to;
  }
  return { kind: 'number', value: Number(t.value ?? 0), unit, span: span(t.from, to) };
}

function parseRecord(c: Cursor, sub: SubParser): RecordExpr {
  const open = c.next();
  c.enter(open);
  const fields: Arg[] = [];
  while (c.is('ident') && c.isPunct(':', 1)) {
    fields.push(parseArg(c, sub));
    if (!c.eat('punct', ',')) break;
  }
  const close = c.expect('punct', '}', 'Missing } to close this group of settings.', [insertFix('Add }', c.prev().to, ' }')]);
  c.leave();
  return { kind: 'record', fields, span: span(open.from, close.to) };
}
