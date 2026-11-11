/**
 * The run's scores on the shared generation axis. Between two scores the
 * line joins across reference only generations (undefined, which uPlot
 * skips), but breaks (null) where the run skipped benchmarks: a slow exam
 * under Max scores only some champions, and a long straight line would
 * claim scores nobody measured. A gap counts as skipped when it is more
 * than twice the run's usual spacing.
 */
export function runColumn(xs: readonly number[], points: ReadonlyArray<{ generation: number; benchmark?: number }>): Array<number | null | undefined> {
  const scored = points.map((p) => p.generation);
  let step = Infinity;
  for (let i = 1; i < scored.length; i++) step = Math.min(step, scored[i] - scored[i - 1]);
  const mine = new Map(points.map((r) => [r.generation, r.benchmark]));
  let k = 0;
  return xs.map((g) => {
    while (k < scored.length && scored[k] < g) k++;
    const at = mine.get(g);
    if (at !== undefined) return at;
    const before = scored[k - 1];
    const after = scored[k];
    return before !== undefined && after !== undefined && after - before > 2 * step ? null : undefined;
  });
}
