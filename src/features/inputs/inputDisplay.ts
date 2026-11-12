import type { InputSpec } from '@/engine/env/types';

/**
 * The value as the panel shows it: the name of a category input, "none"
 * or "far" for a reading at its range limit, else the real value and unit.
 */
export function display(spec: InputSpec, v: number): string {
  if (spec.values?.length) {
    let best = spec.values[0];
    for (const c of spec.values) if (Math.abs(c.at - v) < Math.abs(best.at - v)) best = c;
    return best.label;
  }
  if (spec.limit && v >= 0.999) return spec.limit;
  const real = v * spec.scale + spec.offset;
  const digits = Math.abs(real) >= 100 ? 0 : Math.abs(real) >= 10 ? 1 : 2;
  return `${real.toFixed(digits)}${spec.unit ? ` ${spec.unit}` : ''}`;
}
