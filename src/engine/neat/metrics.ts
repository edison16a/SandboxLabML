import { countGenome } from './genome';
import { genomeByteSize } from './serialize';
import type { Genome } from './types';

/** The numbers on the model card for one brain. */
export interface ModelMetrics {
  neurons: { input: number; bias: number; hidden: number; output: number; total: number };
  connections: { enabled: number; disabled: number };
  /** Enabled connection weights. Bias links count as weights, so this is the full parameter count. */
  parameters: number;
  /** Multiply-adds per decision. With one weight per link, it equals the parameter count. */
  costPerDecision: number;
  /** Size in the compact binary format. */
  bytes: number;
}

export function modelMetrics(g: Genome): ModelMetrics {
  const c = countGenome(g);
  return {
    neurons: { input: c.inputs, bias: 1, hidden: c.hidden, output: c.outputs, total: c.inputs + 1 + c.hidden + c.outputs },
    connections: { enabled: c.enabled, disabled: c.disabled },
    parameters: c.enabled,
    costPerDecision: c.enabled,
    bytes: genomeByteSize(g),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
