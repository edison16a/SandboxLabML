export type DiffLine = { kind: 'same' | 'add' | 'remove'; text: string };

/** Above this many cells the table would be too big for a lesson, so the diff falls back to remove all, add all. */
const MAX_CELLS = 400_000;

/**
 * Line diff by longest common subsequence, for showing a lesson solution
 * against what the learner wrote. Lines that only differ in trailing
 * spaces count as the same.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\n$/, '').split('\n');
  const b = after.replace(/\n$/, '').split('\n');
  const eq = (x: string, y: string) => x.trimEnd() === y.trimEnd();
  if (a.length * b.length > MAX_CELLS) return [...a.map((text) => ({ kind: 'remove' as const, text })), ...b.map((text) => ({ kind: 'add' as const, text }))];
  const w = b.length + 1;
  const table = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * w + j] = eq(a[i], b[j]) ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (eq(a[i], b[j])) {
      out.push({ kind: 'same', text: b[j] });
      i++;
      j++;
    } else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) out.push({ kind: 'remove', text: a[i++] });
    else out.push({ kind: 'add', text: b[j++] });
  }
  while (i < a.length) out.push({ kind: 'remove', text: a[i++] });
  while (j < b.length) out.push({ kind: 'add', text: b[j++] });
  return out;
}
