import type { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { liveLinkAlpha, liveNodeAlpha, linkStrength, NEGATIVE_COLOR, NODE_RING, POSITIVE_COLOR } from './drawNetwork';
import { layoutGenome, type LaidOutNode } from './layout';

const KINDS: readonly LaidOutNode['kind'][] = ['input', 'bias', 'hidden', 'output'];

/** Neuron radii when there is room, px, the same as the lab graph. Hidden neurons are a step smaller. */
const NODE_RADIUS = 5.5;
const HIDDEN_RADIUS = 4.5;
/**
 * Largest radius as a share of the row spacing in a column. With the ring
 * around it a dot spans about 2.4 radii, so 0.36 leaves a clear gap.
 */
const RADIUS_SHARE = 0.36;

/** Activations shown next to the outputs, from -1.00 to 1.00, made once so a frame builds no strings. */
const VALUE_TEXT = Array.from({ length: 201 }, (_, i) => ((i - 100) / 100).toFixed(2));

/** The text for an output value, rounded to hundredths. */
export function valueText(v: number): string {
  const i = Math.round(Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0)) * 100) + 100;
  return VALUE_TEXT[i];
}

export interface PainterBox {
  width: number;
  height: number;
  /** Room around the graph, px. Output names and values sit in the right margin. */
  margin: { left: number; right: number; top: number; bottom: number };
}

/**
 * The network graph drawn over and over with fresh activations, for a view
 * that repaints every tick. It uses the same layout, colors and link rules
 * as the lab's graph, but works out every position and the network slot of
 * every neuron once per size, so painting a frame allocates nothing.
 */
export class NetworkPainter {
  private readonly nodes: LaidOutNode[];
  private readonly kind: Uint8Array;
  /** Index into Network.values for each laid out node, or -1 when the network skips it. */
  private readonly slot: Int32Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  /** How many neurons share each neuron's column, which sets how much room each one gets. */
  private readonly columnSize: Float32Array;
  /** Radius of each neuron at the current size, px. */
  private readonly r: Float32Array;
  private readonly from: Int32Array;
  private readonly to: Int32Array;
  private readonly strength: Float32Array;
  private readonly positive: Uint8Array;
  private readonly outputs: number[];
  /** The font for output names and values, built once so paint assigns a ready string. */
  private font = '500 12px sans-serif';

  constructor(
    genome: Genome,
    private readonly net: Network,
    private readonly outputLabels: readonly string[],
  ) {
    this.nodes = layoutGenome(genome);
    const index = new Map(this.nodes.map((n, i) => [n.id, i]));
    const slotOf = new Map(Array.from(net.nodeIds, (id, s) => [id, s]));
    this.kind = Uint8Array.from(this.nodes, (n) => KINDS.indexOf(n.kind));
    this.slot = Int32Array.from(this.nodes, (n) => slotOf.get(n.id) ?? -1);
    this.x = new Float32Array(this.nodes.length);
    this.y = new Float32Array(this.nodes.length);
    // The layout puts each column at one x, so neurons with the same x stack in one column.
    const perColumn = new Map<number, number>();
    for (const n of this.nodes) perColumn.set(n.x, (perColumn.get(n.x) ?? 0) + 1);
    this.columnSize = Float32Array.from(this.nodes, (n) => perColumn.get(n.x) ?? 1);
    this.r = new Float32Array(this.nodes.length);
    const links =genome.connections.filter((c) => c.enabled && index.has(c.from) && index.has(c.to));
    this.from = Int32Array.from(links, (c) => index.get(c.from) ?? 0);
    this.to = Int32Array.from(links, (c) => index.get(c.to) ?? 0);
    this.strength = Float32Array.from(links, (c) => linkStrength(c.weight));
    this.positive = Uint8Array.from(links, (c) => (c.weight >= 0 ? 1 : 0));
    this.outputs = this.nodes.flatMap((n, i) => (n.kind === 'output' ? [i] : []));
  }

  /** The latest activation of laid out node i. An arrow property, so paint can alias it without binding each frame. */
  private readonly activation = (i: number): number => (this.slot[i] >= 0 ? this.net.values[this.slot[i]] : 0);

  /** Sets the family the output labels draw in, as canvasFontFamily gives it. A canvas cannot read the CSS variable itself. */
  setFontFamily(family: string): void {
    this.font = `500 12px ${family}`;
  }

  /**
   * Places every neuron inside the box and sizes it. Call it whenever the
   * canvas changes size. A neuron keeps the lab graph's size while its
   * column has room, and shrinks in a crowded column (17 inputs in a short
   * card) so neighbours never overlap and every input stays its own dot.
   */
  layout(box: PainterBox): void {
    const w = box.width - box.margin.left - box.margin.right;
    const h = box.height - box.margin.top - box.margin.bottom;
    this.nodes.forEach((n, i) => {
      this.x[i] = box.margin.left + n.x * w;
      this.y[i] = box.margin.top + n.y * h;
      const full = n.kind === 'hidden' ? HIDDEN_RADIUS : NODE_RADIUS;
      this.r[i] = Math.max(1, Math.min(full, (RADIUS_SHARE * h) / this.columnSize[i]));
    });
  }

  /** Paints the graph with the network's latest activations. The context must already be cleared and scaled. */
  paint(g: CanvasRenderingContext2D): void {
    const act = this.activation;
    g.lineCap = 'round';
    for (let k = 0; k < this.from.length; k++) {
      const a = this.from[k];
      const b = this.to[k];
      const dx = (this.x[b] - this.x[a]) * 0.45;
      g.globalAlpha = liveLinkAlpha(this.strength[k], act(a));
      g.strokeStyle = this.positive[k] ? POSITIVE_COLOR : NEGATIVE_COLOR;
      g.lineWidth = 0.6 + this.strength[k] * 2.6;
      g.beginPath();
      g.moveTo(this.x[a], this.y[a]);
      g.bezierCurveTo(this.x[a] + dx, this.y[a], this.x[b] - dx, this.y[b], this.x[b], this.y[b]);
      g.stroke();
    }
    for (let i = 0; i < this.nodes.length; i++) {
      const v = act(i);
      const kind = KINDS[this.kind[i]];
      g.beginPath();
      g.arc(this.x[i], this.y[i], this.r[i], 0, Math.PI * 2);
      // An opaque base keeps links from showing through the faint fill of a quiet neuron.
      g.globalAlpha = 1;
      g.fillStyle = '#10141c';
      g.fill();
      g.globalAlpha = liveNodeAlpha(v);
      g.fillStyle = v >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      g.fill();
      g.globalAlpha = 1;
      // A small dot gets a thinner ring, so the ring never fills it in.
      g.lineWidth = Math.min(1.4, this.r[i] * 0.4);
      g.strokeStyle = NODE_RING[kind];
      g.stroke();
    }
    g.font = this.font;
    g.textBaseline = 'middle';
    g.fillStyle = '#e7ebf3';
    for (let k = 0; k < this.outputs.length; k++) {
      const i = this.outputs[k];
      g.textAlign = 'left';
      g.globalAlpha = 0.9;
      g.fillText(this.outputLabels[this.nodes[i].slot] ?? '', this.x[i] + 12, this.y[i]);
      g.textAlign = 'right';
      g.globalAlpha = 1;
      g.fillText(valueText(act(i)), this.x[i] + 92, this.y[i]);
    }
    g.globalAlpha = 1;
  }
}
