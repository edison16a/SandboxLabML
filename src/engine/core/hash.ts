/**
 * Stable hashing for configs and scripts. Physics configs are hashed so a
 * stored genome can tell whether it was trained under the current rules.
 */

/** FNV-1a 32-bit hash of a string, returned as 8 hex characters. */
export function hashString(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** JSON with sorted keys, so two equal objects always serialize the same way. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${body.join(',')}}`;
}

export function hashObject(value: unknown): string {
  return hashString(stableStringify(value));
}
