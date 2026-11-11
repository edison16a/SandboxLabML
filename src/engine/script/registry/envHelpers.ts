import type { GenerationView } from '../generationTypes';
import { entry } from './define';
import type { PresetTier, RegistryEntry, ResultUnit, SliceEnv } from './types';

/**
 * Sets one key of the script's requests to its env, such as a level, and
 * keeps what other operators asked for in the same generation block. An
 * env's operators call this rather than assigning `directives.env`, so a
 * level and a traffic density can both land.
 */
export function setEnvDirective(view: unknown, key: string, value: unknown): void {
  const d = (view as GenerationView).directives;
  d.env = { ...d.env, [key]: value };
}

/** What a metric sensor says about itself, in the registry's words. */
export interface MetricSensorDocs {
  name: string;
  env: SliceEnv;
  /** The key in the env's generation metrics, as the module declares it. */
  key: string;
  unit: ResultUnit;
  label: string;
  summary: string;
  description: string;
  example: string;
  explain: string;
  range?: readonly [number, number];
  presets?: readonly PresetTier[];
}

/**
 * A generation block sensor that reads one of the env's generation metrics
 * (GenerationContext.metrics), such as the share that arrived. It reads 0
 * before the env has reported the metric.
 */
export function metricSensor(d: MetricSensorDocs): RegistryEntry {
  const { key, label, ...rest } = d;
  return entry({
    ...rest,
    kind: 'sensor',
    scope: 'generation',
    type: 'number',
    block: { category: 'evolution', label },
    binding: { kind: 'num', read: () => (v) => (v as GenerationView).ctx.metrics?.[key] ?? 0 },
  });
}
