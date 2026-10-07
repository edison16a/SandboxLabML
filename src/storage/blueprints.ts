import { normalizeBlueprint } from '@/engine/blueprints/normalize';
import type { Blueprint } from '@/engine/blueprints/types';
import type { EnvId } from '@/engine/env/types';
import { db } from './db';

/** The user's own blueprints. Presets live in code and are never stored. */
export async function listBlueprints(env: EnvId): Promise<Blueprint[]> {
  const rows = await db().blueprints.where('env').equals(env).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt).map((r) => normalizeBlueprint(r.blueprint));
}

export async function saveBlueprint(b: Blueprint): Promise<void> {
  await db().blueprints.put({ id: b.id, env: b.env, blueprint: b, updatedAt: Date.now() });
}

export async function deleteBlueprint(id: string): Promise<void> {
  await db().blueprints.delete(id);
}

/** A fresh id for a copied blueprint, e.g. "racing-standard-copy-3fa1". */
export function copyId(base: string): string {
  const tail = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${base.replace(/-copy-[0-9a-f]{4}$/, '')}-copy-${tail}`;
}
