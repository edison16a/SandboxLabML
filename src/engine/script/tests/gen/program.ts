import { Rng } from '../../../core/rng';
import { boolExpr, literal, numExpr, UNITS, type Env, type Local } from './exprs';

/**
 * Seeded generator of valid racing scripts, with comments and blank lines
 * sprinkled in. Round trip tests run it a few hundred times, so it covers
 * shapes no hand-written test would think of.
 */
export function randomProgram(seed: number): string {
  const g = new Gen(new Rng(seed));
  return g.program();
}

class Gen {
  private lines: string[] = [];
  private counter = 0;
  private constants: Local[] = [];

  constructor(private readonly rng: Rng) {}

  private comment(indent: string): void {
    if (this.rng.chance(0.15)) this.lines.push(`${indent}// ${this.rng.pick(['note', 'tune this later', 'why: progress', ''])}`.trimEnd());
    if (this.rng.chance(0.08)) this.lines.push('');
  }

  private trailing(): string {
    return this.rng.chance(0.15) ? ` // ${this.rng.pick(['here', 'see docs', 'x'])}` : '';
  }

  private fresh(prefix: string): string {
    return `${prefix}${++this.counter}`;
  }

  program(): string {
    const rng = this.rng;
    this.comment('');
    this.lines.push(`script "Random ${rng.int(1000)}" for racing v1${this.trailing()}`);
    if (rng.chance(0.8)) this.lines.push(`brain ${rng.pick(['racing-tiny', 'racing-starter', 'racing-standard', 'racing-advanced'])}`);
    for (let i = rng.int(3); i > 0; i--) {
      this.comment('');
      const unit = rng.pick(UNITS);
      const name = this.fresh('k');
      this.lines.push(`let ${name} = ${literal({ rng, scope: 'tick', locals: [] }, unit)}${this.trailing()}`);
      this.constants.push({ name, kind: 'num', unit });
    }
    for (let i = rng.int(3); i > 0; i--) {
      this.comment('');
      const unit = rng.pick(UNITS);
      const env: Env = { rng, scope: 'tick', locals: [...this.constants], sensor: true };
      const lo = rng.pick(['0', '1', '2']);
      const range = unit === '' ? `${lo} .. 50` : `${lo} ${unit} .. 50 ${unit}`;
      this.lines.push(`sensor ${this.fresh('sense')} "Sensor ${i}" in ${range} = ${numExpr(env, unit, 2)}`);
    }
    this.lines.push('');
    this.block('each tick', 'tick', '', true);
    if (rng.chance(0.85)) {
      this.lines.push('');
      this.block('each generation', 'generation', '', false);
    }
    this.comment('');
    return `${this.lines.join('\n')}\n`;
  }

  private block(head: string, scope: Env['scope'], indent: string, needsDrive: boolean): void {
    this.lines.push(`${indent}${head} {${this.trailing()}`);
    const env: Env = { rng: this.rng, scope, locals: [...this.constants] };
    if (needsDrive) this.lines.push(`${indent}  drive(steer: ${numExpr(env, '', 1)}, pedal: brain.pedal)`);
    this.stmts(env, `${indent}  `, 3);
    this.lines.push(`${indent}}`);
  }

  private stmts(env: Env, indent: string, depth: number): void {
    const n = 1 + this.rng.int(4);
    const mark = env.locals.length;
    for (let i = 0; i < n; i++) {
      this.comment(indent);
      this.stmt(env, indent, depth);
    }
    env.locals.length = mark;
  }

  private nested(env: Env, head: string, indent: string, depth: number, extra?: Local): void {
    this.lines.push(`${indent}${head} {${this.trailing()}`);
    if (extra) env.locals.push(extra);
    this.stmts(env, `${indent}  `, depth - 1);
    if (extra) env.locals.pop();
    this.lines.push(`${indent}}`);
  }

  private stmt(env: Env, indent: string, depth: number): void {
    const rng = this.rng;
    const tick = env.scope === 'tick';
    const pick = rng.int(depth > 0 ? 8 : 4);
    if (pick === 0) {
      const name = this.fresh('x');
      const isBool = rng.chance(0.3);
      const unit = rng.pick(UNITS);
      this.lines.push(`${indent}let ${name} = ${isBool ? boolExpr(env, 2) : numExpr(env, unit, 2)}${this.trailing()}`);
      env.locals.push({ name, kind: isBool ? 'bool' : 'num', unit });
    } else if (pick === 1 || pick === 2) {
      if (tick) {
        const when = rng.chance(0.6) ? ` when ${boolExpr(env, 2)}` : '';
        this.lines.push(`${indent}reward ${numExpr(env, rng.pick(UNITS), 2)}${when}${this.trailing()}`);
      } else {
        this.lines.push(`${indent}${this.operator(env)}${this.trailing()}`);
      }
    } else if (pick === 3) {
      if (tick) this.lines.push(`${indent}stop "${rng.pick(['crash', 'stalled', 'slow', 'done'])}" when ${boolExpr(env, 2)}`);
      else this.lines.push(`${indent}${this.operator(env)}`);
    } else if (pick === 4 || pick === 5) {
      this.nested(env, `if ${boolExpr(env, 2)}`, indent, depth);
      const last = this.lines.length - 1;
      if (rng.chance(0.4)) {
        this.lines[last] = `${indent}} else {`;
        this.stmts(env, `${indent}  `, depth - 1);
        this.lines.push(`${indent}}`);
      } else if (rng.chance(0.3)) {
        this.lines.pop();
        this.nested(env, `} else if ${boolExpr(env, 1)}`, indent, depth);
      }
    } else if (pick === 6) {
      this.nested(env, `repeat ${1 + rng.int(4)}`, indent, depth);
    } else if (tick) {
      const name = this.fresh('r');
      this.nested(env, `for each ${name} in rays`, indent, depth, { name, kind: 'num', unit: 'm' });
    } else {
      this.lines.push(`${indent}keepChampions()`);
    }
  }

  private operator(env: Env): string {
    const rng = this.rng;
    switch (rng.int(5)) {
      case 0:
        return `speciate(target: ${1 + rng.int(12)}${rng.chance(0.3) ? ', adaptive: true' : ''})`;
      case 1:
        return `select(top: ${5 + rng.int(40)}%)`;
      case 2:
        return `breed(crossover: ${rng.pick(['0.5', '0.75'])}, mutate: { weights: 0.8, addNode: ${literal(env, '')} / 100 })`;
      case 3:
        return rng.chance(0.5) ? 'useTrack(id: "hairpin")' : 'randomTrack(seed: generation)';
      default:
        return 'keepChampions()';
    }
  }
}
