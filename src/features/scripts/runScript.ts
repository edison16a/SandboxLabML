import { scriptAt, type RunConfig } from '@/engine/training/runConfig';

/** What the lab says about the script a run trains with. */
export interface RunScriptInfo {
  /** The script's own name from its header, or a plain label for the built-in reward. */
  name: string;
  builtin: boolean;
  /** The generation the version in force took over, when it was edited after the run began. */
  editedAt: number | null;
}

/** A script names itself on its first line: script "Beginner: first laps" for racing v1. */
const HEADER = /^\s*script\s+"([^"\n]+)"/m;

/** The name a script gives itself, or a fallback when the header has none. */
export function scriptName(source: string): string {
  return HEADER.exec(source)?.[1].trim() || 'Untitled script';
}

/**
 * Which script drives `generation` of a run, said the way the toolbar shows
 * it. Reads only the header line, so it is cheap enough to run on every
 * render without compiling anything.
 */
export function runScriptInfo(config: RunConfig, generation: number): RunScriptInfo {
  const version = scriptAt(config, generation);
  if (!version) return { name: 'Built-in rewards', builtin: true, editedAt: null };
  return { name: scriptName(version.source), builtin: false, editedAt: version.fromGeneration > 0 ? version.fromGeneration : null };
}
