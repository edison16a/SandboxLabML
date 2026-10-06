/**
 * NEAT genome types. A genome is a list of neurons and a list of weighted
 * connections. Connections carry a global innovation number so two genomes
 * can be lined up gene by gene during crossover and speciation.
 */

export type NodeKind = 'input' | 'bias' | 'output' | 'hidden';

export type Activation = 'tanh' | 'sigmoid' | 'relu' | 'gaussian' | 'sine';

export const ACTIVATIONS: readonly Activation[] = ['tanh', 'sigmoid', 'relu', 'gaussian', 'sine'];

export interface NodeGene {
  id: number;
  kind: NodeKind;
}

export interface ConnectionGene {
  innovation: number;
  from: number;
  to: number;
  weight: number;
  enabled: boolean;
}

export interface Genome {
  id: number;
  /** Input node ids in observation order. Index i reads observation[i]. */
  inputs: number[];
  /** Output node ids in action order. */
  outputs: number[];
  biasId: number;
  /** All nodes, including inputs, bias and outputs. */
  nodes: NodeGene[];
  /** Kept sorted by innovation number. */
  connections: ConnectionGene[];
  /** Hidden-node activation. Outputs always use tanh so actions stay in [-1, 1]. */
  activation: Activation;
  fitness: number;
  /** Generation the genome was born in, for the network growth slider. */
  birthGeneration: number;
  speciesId: number;
}

/** What the brain looks like before evolution adds anything. */
export interface GenomeShape {
  inputCount: number;
  outputCount: number;
  activation: Activation;
  /** direct: every input to every output; sparse: half of them; hidden: one small layer. */
  wiring: 'direct' | 'sparse' | 'hidden';
  hiddenCount?: number;
}
