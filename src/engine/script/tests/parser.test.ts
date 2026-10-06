import { describe, expect, it } from 'vitest';
import type { EachItem, Stmt } from '../ast';
import { applyEdits } from '../diagnostics';
import { tokenize } from '../highlight';
import { parse } from '../parser';
import { print } from '../printer';
import { inTick } from './helpers';

const tickBody = (source: string): Stmt[] => (parse(source).program.items.find((i) => i.kind === 'each') as EachItem).body.stmts;
const codes = (source: string) => parse(source).diagnostics.map((d) => d.code);

describe('tokenize', () => {
  it('labels every kind of span, including words that are keywords only in context', () => {
    const src = 'brain racing-starter\neach tick { // hi\n  reward +0.5 * car.speed when x >= 3 m/s\n  stop "a" when brain.steer > 20% and generation % 10 == 0 ; }';
    const spans = tokenize(src).map((s) => `${s.kind}:${src.slice(s.from, s.to)}`);
    expect(spans).toEqual([
      'keyword:brain', 'ident:racing-starter', 'keyword:each', 'keyword:tick', 'punctuation:{', 'comment:// hi', 'keyword:reward', 'operator:+',
      'number:0.5', 'operator:*', 'ident:car', 'punctuation:.', 'ident:speed', 'keyword:when', 'ident:x', 'operator:>=', 'number:3', 'unit:m/s',
      'keyword:stop', 'string:"a"', 'keyword:when', 'ident:brain', 'punctuation:.', 'ident:steer', 'operator:>', 'number:20', 'unit:%',
      'keyword:and', 'ident:generation', 'operator:%', 'number:10', 'operator:==', 'number:0', 'invalid:;', 'punctuation:}',
    ]);
  });

  it('covers every character that is not whitespace, whatever the input', () => {
    const inputs = ['"open string', '@@@ ### `x`', '5 m/s² + 1/m', '\u0000\u0001 😀 é', '1e999 + .5', '// only a comment'];
    for (const src of inputs) {
      const covered = new Array<boolean>(src.length).fill(false);
      for (const s of tokenize(src)) for (let i = s.from; i < s.to; i++) covered[i] = true;
      for (let i = 0; i < src.length; i++) {
        if (!/\s/.test(src[i]) && !covered[i]) throw new Error(`${JSON.stringify(src)} leaves ${src[i]} at ${i}`);
      }
    }
  });
});

describe('parser', () => {
  it('reports one error per broken line and keeps the good lines', () => {
    const src = inTick('  reward +1 when checkpoint.passed\n  reward ) 3\n  stop "crash" when car.offTrack\n  let = 2\n  reward 2');
    const errors = parse(src).diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(2);
    expect(tickBody(src).map((s) => s.kind)).toEqual(['reward', 'stop', 'reward']);
  });

  it('reports a missing closing brace with a fix that makes the script valid', () => {
    const src = 'script "t" for racing v1\neach tick {\n  reward 1 // keep\n\neach generation {\n  keepChampions()\n}\n';
    const d = parse(src).diagnostics.find((x) => x.code === 'missing-brace');
    expect(d?.message).toBe('Missing } to close the block opened on line 2.');
    const fixed = applyEdits(src, d!.fixes![0].edits);
    expect(parse(fixed).diagnostics).toEqual([]);
    expect(fixed).toContain('reward 1 // keep\n}');
  });

  it('asks for a header, and offers one', () => {
    const src = 'each tick {\n  reward 1\n}\n';
    const d = parse(src).diagnostics[0];
    expect(d.code).toBe('missing-header');
    expect(parse(applyEdits(src, d.fixes![0].edits)).diagnostics).toEqual([]);
  });

  it('explains common mistakes', () => {
    expect(codes(inTick('  reward 1 when 1 < 2 < 3'))).toEqual(['chained-compare']);
    expect(codes(inTick('  reward 1 reward 2'))).toEqual(['same-line']);
    expect(codes(inTick('  else {\n  }'))).toEqual(['stray-else']);
    expect(codes(`${inTick('  reward 1')}}\n`)).toEqual(['stray-brace']);
    expect(codes(inTick('  stop "crash'))).toContain('unterminated-string');
    expect(codes(inTick('  reward 1').replace('each tick', 'reward 1\neach tick'))).toEqual(['outside-block']);
    expect(codes(inTick('  repeat 2 s {\n  }'))).toEqual(['expected-count']);
  });

  it('attaches comments to the right lines', () => {
    const src = inTick('  // above\n  reward 1 // after\n  if x { // open\n    reward 2\n    // dangling\n  } // closing\n  reward (1 // inside\n  )');
    const [first, second, third] = tickBody(src);
    expect(first.leading.map((c) => c.text)).toEqual(['above']);
    expect(first.trailing?.text).toBe('after');
    expect(second.kind === 'if' && second.then.openComment?.text).toBe('open');
    expect(second.kind === 'if' && second.then.dangling.map((c) => c.text)).toEqual(['dangling']);
    expect(second.trailing?.text).toBe('closing');
    expect(third.leading.map((c) => c.text)).toEqual(['inside']);
  });

  it('prints else if chains flat', () => {
    const src = inTick('  if a {\n    reward 1\n  } else if b {\n    reward 2\n  } else {\n    reward 3\n  }');
    expect(print(parse(src).program)).toBe(src.replace('\n\neach', '\neach').replace('standard\n', 'standard\n\n'));
  });

  it('tells % for percent apart from % for remainder', () => {
    const src = inTick('  reward 1 when generation % 10 == 0 and car.slip > 20%');
    const printed = print(parse(src).program);
    expect(printed).toContain('generation % 10 == 0 and car.slip > 20%');
  });
});
