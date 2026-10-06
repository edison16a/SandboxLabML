import { describe, expect, it } from 'vitest';
import { parse } from '../../script/parser';
import { matchesAny } from '../astMatch';
import type { AstPattern } from '../types';

const SCRIPT = `script "t" for racing v1
brain racing-standard
sensor bend "Bend" in -0.05 1/m .. 0.05 1/m = track.curvatureAhead(distance: 40 m)
let limit = 0.3

each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +1 when checkpoint.passed
  if car.speed > 10 m/s {
    reward -0.05 when car.slip > limit
  }
  stop "crash" when car.offTrack
}

each generation {
  speciate(target: 8)
  if generation % 10 == 0 and generation > 0 {
    randomTrack(seed: generation)
  }
}
`;

const program = parse(SCRIPT).program;
const has = (...patterns: AstPattern[]) => matchesAny(program, patterns);

describe('AST patterns', () => {
  it('match statement kinds with the names they use', () => {
    expect(has({ stmt: 'reward', uses: ['checkpoint.passed'] })).toBe(true);
    expect(has({ stmt: 'stop', scope: 'tick', uses: ['car.offTrack'] })).toBe(true);
    expect(has({ stmt: 'reward', uses: ['lap.completed'] })).toBe(false);
    expect(has({ stmt: 'stop', uses: ['car.noProgress'] })).toBe(false);
  });

  it('find statements nested inside if blocks', () => {
    expect(has({ stmt: 'reward', scope: 'tick', uses: ['car.slip', 'limit'] })).toBe(true);
    expect(has({ stmt: 'call', scope: 'generation', callee: 'randomTrack' })).toBe(true);
  });

  it('respect the scope a statement lives in', () => {
    expect(has({ stmt: 'call', scope: 'tick', callee: 'speciate' })).toBe(false);
    expect(has({ stmt: 'call', scope: 'generation', callee: 'speciate' })).toBe(true);
    expect(has({ stmt: 'sensor', scope: 'top', uses: ['track.curvatureAhead'] })).toBe(true);
    expect(has({ stmt: 'let', scope: 'top' })).toBe(true);
    expect(has({ stmt: 'let', scope: 'tick' })).toBe(false);
  });

  it('match calls by callee and by their arguments', () => {
    expect(has({ stmt: 'call', callee: 'drive', uses: ['brain.steer', 'brain.pedal'] })).toBe(true);
    expect(has({ stmt: 'call', callee: 'drive', uses: ['car.speed'] })).toBe(false);
  });

  it('let an if pattern look at its condition and its body', () => {
    expect(has({ stmt: 'if', scope: 'generation', uses: ['generation'] })).toBe(true);
    expect(has({ stmt: 'if', scope: 'generation', callee: 'randomTrack' })).toBe(true);
    expect(has({ stmt: 'if', scope: 'tick', uses: ['car.speed', 'car.slip'] })).toBe(true);
    expect(has({ stmt: 'if', scope: 'tick', uses: ['stagnation'] })).toBe(false);
  });

  it('pass when any one of several patterns matches', () => {
    expect(has({ stmt: 'reward', uses: ['lap.completed'] }, { stmt: 'stop', uses: ['car.offTrack'] })).toBe(true);
    expect(has()).toBe(false);
  });
});
