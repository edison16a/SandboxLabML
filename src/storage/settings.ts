import { db } from './db';

/** Small key-value settings, such as the last opened run. */
export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await db().settings.get(key);
  return (row?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db().settings.put({ key, value });
}
