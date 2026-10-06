import type { CallExpr, Expr, ForEachStmt, LetStmt, Program } from '../ast';
import { makeDiagnostic, type Diagnostic, type QuickFix, type Span } from '../diagnostics';
import type { EnvId } from '../../env/types';
import type { ParamDef, RegistryEntry } from '../registry';
import type { ValueType } from '../types';

/** Where an expression is being checked: a top-level constant, a script sensor, or one of the two blocks. */
export type CheckScope = 'top' | 'sensor' | 'tick' | 'generation';

/** What a name turned out to be. The compiler builds its closure from this. */
export type NameRef =
  | { kind: 'entry'; entry: RegistryEntry }
  | { kind: 'slot'; slot: number }
  | { kind: 'item'; slot: number; collection: RegistryEntry };

export interface ExprInfo {
  type: ValueType;
  /** Value of a constant expression in base units (radians, plain fractions), known at compile time. */
  value?: number | boolean;
  ref?: NameRef;
}

export interface ResolvedArg {
  param: ParamDef;
  /** The argument as written, or null when the parameter was left at its default. */
  expr: Expr | null;
}

export interface CallInfo {
  entry: RegistryEntry;
  args: ResolvedArg[];
}

export interface Declaration {
  name: string;
  span: Span;
  kind: 'const' | 'let' | 'loop' | 'sensor';
  used: boolean;
}

interface Local {
  slot: number;
  type: ValueType;
  decl: Declaration;
  collection?: RegistryEntry;
}

interface Constant {
  type: ValueType;
  value: number | boolean;
  decl: Declaration;
}

/** Everything the compiler, linter and cost model need from a checked program. */
export interface CheckResult {
  program: Program;
  env: EnvId | null;
  diagnostics: Diagnostic[];
  exprs: Map<Expr, ExprInfo>;
  calls: Map<CallExpr, CallInfo>;
  slots: Map<LetStmt | ForEachStmt, number>;
  slotCount: { tick: number; generation: number };
  declarations: Declaration[];
  usesRand: { tick: boolean; generation: boolean };
  needs: Set<'track'>;
}

/**
 * Mutable state of one checker run: diagnostics, what each expression
 * resolved to, and the stack of local scopes. Locals get a slot number here,
 * so the compiled script can keep them in one preallocated Float64Array.
 */
export class CheckContext {
  readonly diagnostics: Diagnostic[] = [];
  readonly exprs = new Map<Expr, ExprInfo>();
  readonly calls = new Map<CallExpr, CallInfo>();
  readonly slots = new Map<LetStmt | ForEachStmt, number>();
  readonly declarations: Declaration[] = [];
  readonly constants = new Map<string, Constant>();
  readonly sensorNames = new Set<string>();
  readonly slotCount = { tick: 0, generation: 0 };
  readonly usesRand = { tick: false, generation: false };
  readonly needs = new Set<'track'>();
  scope: CheckScope = 'top';
  private frames: Map<string, Local>[] = [];

  constructor(
    readonly env: EnvId | null,
    readonly names: ReadonlyMap<string, RegistryEntry>,
    readonly renames: ReadonlyMap<string, RegistryEntry>,
  ) {}

  report(severity: Diagnostic['severity'], code: string, message: string, span: Span, fixes?: QuickFix[]): void {
    this.diagnostics.push(makeDiagnostic(severity, code, message, span, fixes));
  }

  error(code: string, message: string, span: Span, fixes?: QuickFix[]): void {
    this.report('error', code, message, span, fixes);
  }

  /** The block scope registry entries are matched against. Sensors run in tick scope. */
  get blockScope(): 'tick' | 'generation' {
    return this.scope === 'generation' ? 'generation' : 'tick';
  }

  pushFrame(): void {
    this.frames.push(new Map());
  }

  popFrame(): void {
    this.frames.pop();
  }

  /** Finds a local or loop variable, innermost first, and marks it used. */
  lookupLocal(name: string): Local | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const local = this.frames[i].get(name);
      if (local) {
        local.decl.used = true;
        return local;
      }
    }
    return undefined;
  }

  lookupConstant(name: string): Constant | undefined {
    const c = this.constants.get(name);
    if (c) c.decl.used = true;
    return c;
  }

  /** Any user-defined name in sight. Shadowing is not allowed, which keeps scripts easy to read. */
  isDefined(name: string): boolean {
    return this.constants.has(name) || this.sensorNames.has(name) || this.frames.some((f) => f.has(name));
  }

  localNames(): string[] {
    return [...this.constants.keys(), ...this.frames.flatMap((f) => [...f.keys()])];
  }

  declare(name: string, span: Span, kind: Declaration['kind']): Declaration {
    const decl: Declaration = { name, span, kind, used: false };
    this.declarations.push(decl);
    return decl;
  }

  /** Adds a local to the innermost frame and gives it the next slot of the current block. */
  addLocal(stmt: LetStmt | ForEachStmt, name: string, decl: Declaration, type: ValueType, collection?: RegistryEntry): void {
    const scope = this.blockScope;
    const slot = this.slotCount[scope]++;
    this.slots.set(stmt, slot);
    this.frames[this.frames.length - 1]?.set(name, { slot, type, decl, collection });
  }

  result(program: Program): CheckResult {
    return {
      program,
      env: this.env,
      diagnostics: this.diagnostics,
      exprs: this.exprs,
      calls: this.calls,
      slots: this.slots,
      slotCount: this.slotCount,
      declarations: this.declarations,
      usesRand: this.usesRand,
      needs: this.needs,
    };
  }
}
