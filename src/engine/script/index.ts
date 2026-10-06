/**
 * SBL, the SandboxLab Language: a small, safe language for training loops.
 * Scripts are parsed with error recovery, checked against the API registry
 * (names, kinds, units and scopes), and compiled to closure trees. Nothing
 * ever evaluates generated JavaScript.
 */
export * from './ast';
export * from './diagnostics';
export { lex, KEYWORDS, type Token, type TokenKind, type LexResult } from './lexer';
export { tokenize, type HighlightKind, type HighlightSpan } from './highlight';
export { parse, emptyProgram, type ParseResult } from './parser';
export { print, printStmt, printExpr, formatNumber, type PrintOptions } from './printer';
export * from './units';
export * from './types';
export { check, type CheckOptions, type CheckResult, type ExprInfo, type CallInfo, type NameRef, type ResolvedArg, type Declaration } from './checker';
export { lint } from './lint';
export { explainExpr, explainStmt } from './explain';
export { estimateCost, costToMicros, HIGH_COST, NS_PER_UNIT } from './cost';
export { compileScript, classifyChange, type CompiledScript, type CompileResult, type ChangeKind, type ScriptHeader } from './compiler';
export type { GenerationContext, GenerationDirectives, GenerationView, TrackDirective } from './generationTypes';
export { createScriptHost, ScriptCompileError, type ScriptHostAdapter } from './host';
export * from './autocorrect';
export * from './registry';
export * from './blocks';
export { RACING_PRESETS, findScriptPreset, type ScriptPreset } from './presets/racing';
