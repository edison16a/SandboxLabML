import { ACTIVATIONS, type Genome, type NodeGene, type NodeKind } from './types';

/**
 * Compact binary genome format, about 16 bytes per connection plus 8 per
 * neuron. Weights are stored as float32, and mutation already rounds every
 * weight to float32, so a round trip is exact and replays stay deterministic.
 *
 * Layout (little endian):
 *   header 28 bytes: magic "SBG1", u16 version, u8 activation, u8 flags,
 *   u32 id, u16 nodes, u16 connections, u16 inputs, u16 outputs,
 *   u32 birthGeneration, f32 fitness
 *   nodes 8 bytes each: u32 id, u8 kind, 3 bytes reserved
 *   connections 16 bytes each: u32 innovation, u16 from index, u16 to index,
 *   f32 weight, u8 enabled, 3 bytes reserved
 * Nodes are ordered inputs, bias, outputs, hidden, so the input and output
 * order is implied by position.
 */
const MAGIC = 0x31474253; // "SBG1"
const HEADER = 28;
const KINDS: NodeKind[] = ['input', 'bias', 'output', 'hidden'];

export function genomeByteSize(g: Genome): number {
  return HEADER + g.nodes.length * 8 + g.connections.length * 16;
}

function orderedNodes(g: Genome): NodeGene[] {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const head = [...g.inputs, g.biasId, ...g.outputs].map((id) => byId.get(id) as NodeGene);
  const fixed = new Set([...g.inputs, g.biasId, ...g.outputs]);
  return [...head, ...g.nodes.filter((n) => !fixed.has(n.id))];
}

export function encodeGenome(g: Genome): Uint8Array {
  const nodes = orderedNodes(g);
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const buf = new ArrayBuffer(genomeByteSize(g));
  const v = new DataView(buf);
  v.setUint32(0, MAGIC, true);
  v.setUint16(4, 1, true);
  v.setUint8(6, ACTIVATIONS.indexOf(g.activation));
  v.setUint8(7, 0);
  v.setUint32(8, g.id, true);
  v.setUint16(12, nodes.length, true);
  v.setUint16(14, g.connections.length, true);
  v.setUint16(16, g.inputs.length, true);
  v.setUint16(18, g.outputs.length, true);
  v.setUint32(20, g.birthGeneration, true);
  v.setFloat32(24, Number.isFinite(g.fitness) ? g.fitness : 0, true);
  let o = HEADER;
  for (const n of nodes) {
    v.setUint32(o, n.id, true);
    v.setUint8(o + 4, KINDS.indexOf(n.kind));
    o += 8;
  }
  for (const c of g.connections) {
    v.setUint32(o, c.innovation, true);
    v.setUint16(o + 4, index.get(c.from) ?? 0, true);
    v.setUint16(o + 6, index.get(c.to) ?? 0, true);
    v.setFloat32(o + 8, c.weight, true);
    v.setUint8(o + 12, c.enabled ? 1 : 0);
    o += 16;
  }
  return new Uint8Array(buf);
}

export function decodeGenome(bytes: Uint8Array): Genome {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, true) !== MAGIC) throw new Error('Not a SandboxLab genome');
  const nodeCount = v.getUint16(12, true);
  const connCount = v.getUint16(14, true);
  const inputCount = v.getUint16(16, true);
  const outputCount = v.getUint16(18, true);
  const nodes: NodeGene[] = [];
  let o = HEADER;
  for (let i = 0; i < nodeCount; i++, o += 8) {
    nodes.push({ id: v.getUint32(o, true), kind: KINDS[v.getUint8(o + 4)] });
  }
  const connections = [];
  for (let i = 0; i < connCount; i++, o += 16) {
    connections.push({
      innovation: v.getUint32(o, true),
      from: nodes[v.getUint16(o + 4, true)].id,
      to: nodes[v.getUint16(o + 6, true)].id,
      weight: v.getFloat32(o + 8, true),
      enabled: v.getUint8(o + 12) === 1,
    });
  }
  return {
    id: v.getUint32(8, true),
    inputs: nodes.slice(0, inputCount).map((n) => n.id),
    biasId: nodes[inputCount].id,
    outputs: nodes.slice(inputCount + 1, inputCount + 1 + outputCount).map((n) => n.id),
    nodes,
    connections,
    activation: ACTIVATIONS[v.getUint8(6)] ?? 'tanh',
    fitness: v.getFloat32(24, true),
    birthGeneration: v.getUint32(20, true),
    speciesId: -1,
  };
}

/** Base64 helpers for putting genomes inside JSON exports. */
export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64ToBytes(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
