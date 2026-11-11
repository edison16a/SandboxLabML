/** Trailing mean over `window` values, skipping gaps. */
export function trailingMean(values: ReadonlyArray<number | null>, window: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null) {
      sum += v;
      n++;
    }
    const old = i - window >= 0 ? values[i - window] : null;
    if (old !== null && i - window >= 0) {
      sum -= old;
      n--;
    }
    out.push(n > 0 ? sum / n : null);
  }
  return out;
}
