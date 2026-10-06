import { SCRIPT_API_VERSION } from '@/engine/core/version';
import type { EnvId } from '@/engine/env/types';
import * as sbl from '@/engine/script';
import type { ScriptPreset } from '@/engine/script';
import { newRunId } from '@/engine/training/runConfig';
import { db, type ScriptRow } from './db';

/** How many saved versions a script keeps in its history. */
export const HISTORY_LIMIT = 20;

/** Bumped when the stored row shape changes, so old rows can be migrated on read. */
export const SCRIPT_SCHEMA_VERSION = 1;

/** A script as the Studio lists it. Presets are not stored, so they carry a flag instead of a row. */
export interface ScriptEntry extends ScriptRow {
  readonly: boolean;
  /** Preset description, shown under the name. Empty for the user's own scripts. */
  description: string;
}

function isPresetList(value: unknown): value is readonly ScriptPreset[] {
  return Array.isArray(value) && value.every((p) => p && typeof p.id === 'string' && typeof p.source === 'string' && typeof p.env === 'string');
}

/**
 * Every preset the script package exports. Lists are found by the
 * `_PRESETS` naming convention, so presets for a new environment show up
 * here as soon as the package exports them, with no change to this file.
 */
export function allPresets(): readonly ScriptPreset[] {
  const seen = new Set<string>();
  const out: ScriptPreset[] = [];
  for (const [key, value] of Object.entries(sbl)) {
    if (!key.endsWith('_PRESETS') || !isPresetList(value)) continue;
    for (const p of value) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function presetEntry(p: ScriptPreset): ScriptEntry {
  return {
    id: p.id,
    name: p.name,
    env: p.env,
    source: p.source,
    layout: null,
    tier: p.tier,
    apiVersion: SCRIPT_API_VERSION,
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    updatedAt: 0,
    history: [],
    readonly: true,
    description: p.description,
  };
}

const userEntry = (row: ScriptRow): ScriptEntry => ({ ...row, readonly: false, description: '' });

export function isPresetId(id: string): boolean {
  return allPresets().some((p) => p.id === id);
}

/** The user's scripts, most recently edited first. Pass an env to filter. */
export async function listScripts(env?: EnvId): Promise<ScriptEntry[]> {
  const rows = await db().scripts.orderBy('updatedAt').reverse().toArray();
  return rows.filter((r) => !env || r.env === env).map(userEntry);
}

export function listPresets(env?: EnvId): ScriptEntry[] {
  return allPresets()
    .filter((p) => !env || p.env === env)
    .map(presetEntry);
}

/** A stored script or a preset by id. */
export async function getScript(id: string): Promise<ScriptEntry | undefined> {
  const preset = allPresets().find((p) => p.id === id);
  if (preset) return presetEntry(preset);
  const row = await db().scripts.get(id);
  return row ? userEntry(row) : undefined;
}

/** Reads the environment from the header so a new script lands in the right group. */
export function envFromSource(source: string, fallback: EnvId = 'racing'): EnvId {
  const env = /^\s*script\s+"[^"\n]*"\s+for\s+([a-z]+)/m.exec(source)?.[1];
  return env === 'racing' || env === 'hideseek' ? env : fallback;
}

export interface NewScript {
  name: string;
  source: string;
  env?: EnvId;
}

export async function createScript(input: NewScript): Promise<ScriptEntry> {
  const now = Date.now();
  const row: ScriptRow = {
    id: `s-${newRunId()}`,
    name: input.name.trim() || 'Untitled script',
    env: input.env ?? envFromSource(input.source),
    source: input.source,
    layout: null,
    tier: 'custom',
    apiVersion: SCRIPT_API_VERSION,
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    updatedAt: now,
    history: [{ savedAt: now, source: input.source }],
  };
  await db().scripts.put(row);
  return userEntry(row);
}

function refuseReadonly(id: string): void {
  if (isPresetId(id)) throw new Error('Presets are read only. Duplicate it to make an editable copy.');
}

/**
 * Saves new text. The version lands at the top of the history unless it
 * matches the newest one, and only the last 20 versions are kept.
 */
export async function saveScript(id: string, source: string): Promise<ScriptEntry> {
  refuseReadonly(id);
  const row = await db().scripts.get(id);
  if (!row) throw new Error('This script no longer exists.');
  const now = Date.now();
  const history = row.history[0]?.source === source ? row.history : [{ savedAt: now, source }, ...row.history].slice(0, HISTORY_LIMIT);
  const next: ScriptRow = { ...row, source, env: envFromSource(source, row.env), history, updatedAt: now };
  await db().scripts.put(next);
  return userEntry(next);
}

export async function renameScript(id: string, name: string): Promise<void> {
  refuseReadonly(id);
  const clean = name.trim();
  if (!clean) throw new Error('A script needs a name.');
  await db().scripts.update(id, { name: clean, updatedAt: Date.now() });
}

export async function deleteScript(id: string): Promise<void> {
  refuseReadonly(id);
  await db().scripts.delete(id);
}

/** Copies a preset or a script into a new editable script named "<name> copy". */
export async function duplicateScript(id: string): Promise<ScriptEntry> {
  const from = await getScript(id);
  if (!from) throw new Error('This script no longer exists.');
  return createScript({ name: `${from.name} copy`, source: from.source, env: from.env });
}
