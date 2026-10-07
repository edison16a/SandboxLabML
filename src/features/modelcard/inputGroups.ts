import type { InputSpec } from '@/engine/env/types';

/** A run of related brain inputs, as the model card lists them: a name, how many, and each input's own label. */
export interface InputGroup {
  label: string;
  count: number;
  inputs: string[];
}

/** Keys that belong together, by pattern. Anything else is a group of its own under its label. */
const GROUPS: ReadonlyArray<[RegExp, string]> = [
  [/^ray:\d+$/, 'Ray distances'],
  [/^ray:\d+:(box|agent)$/, 'Ray hit types'],
  [/^box:\d+:/, 'Nearest crates'],
  [/^ramp:/, 'Nearest ramp'],
  [/^custom:/, 'Script sensors'],
];

/**
 * A brain's inputs folded into groups, in schema order, so the model card
 * can say what the brain senses in a few lines: 16 ray distances, the
 * nearest ramp's 6 inputs and so on, with every label one hover away.
 */
export function inputGroups(schema: ReadonlyArray<Pick<InputSpec, 'key' | 'label'>>): InputGroup[] {
  const out: InputGroup[] = [];
  const byLabel = new Map<string, InputGroup>();
  for (const spec of schema) {
    const label = GROUPS.find(([re]) => re.test(spec.key))?.[1] ?? spec.label;
    let group = byLabel.get(label);
    if (!group) {
      group = { label, count: 0, inputs: [] };
      byLabel.set(label, group);
      out.push(group);
    }
    group.count++;
    group.inputs.push(spec.label);
  }
  return out;
}
