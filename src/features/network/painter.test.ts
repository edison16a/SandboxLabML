import { describe, expect, it } from 'vitest';
import { Rng } from '@/engine/core/rng';
import { createGenome, createTemplate } from '@/engine/neat/genome';
import { InnovationTracker } from '@/engine/neat/innovation';
import { mutateAddConnection, mutateAddNode } from '@/engine/neat/mutation';
import { Network } from '@/engine/neat/network';
import { NetworkPainter, valueText } from './NetworkPainter';

/** A 2D context that records where the painter draws. Only what paint calls is implemented. */
function recorder() {
  const points: Array<[number, number]> = [];
  let strokes = 0;
  const texts: string[] = [];
  const g = {
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    beginPath() {},
    moveTo: (x: number, y: number) => void points.push([x, y]),
    bezierCurveTo: (_a: number, _b: number, _c: number, _d: number, x: number, y: number) => void points.push([x, y]),
    arc: (x: number, y: number) => void points.push([x, y]),
    stroke: () => void strokes++,
    fill() {},
    fillText: (t: string) => void texts.push(t),
  };
  return { g: g as unknown as CanvasRenderingContext2D, raw: g, points, texts, strokes: () => strokes };
}

function genome() {
  const tracker = new InnovationTracker();
  const template = createTemplate({ inputCount: 6, outputCount: 2, activation: 'tanh', wiring: 'direct' }, tracker);
  const rng = new Rng(9);
  const g = createGenome(template, tracker, rng, 0);
  for (let i = 0; i < 6; i++) {
    mutateAddNode(g, tracker, rng);
    mutateAddConnection(g, tracker, rng);
  }
  return g;
}

describe('valueText', () => {
  it('rounds to hundredths and stays between -1 and 1', () => {
    expect(valueText(0.123)).toBe('0.12');
    expect(valueText(-0.996)).toBe('-1.00');
    expect(valueText(7)).toBe('1.00');
    expect(valueText(Number.NaN)).toBe('0.00');
  });
});

describe('NetworkPainter', () => {
  it('draws every link and neuron inside its box, with each output named and valued', () => {
    const g = genome();
    const net = new Network(g);
    net.activate(new Float64Array(6).fill(0.5), new Float64Array(2));
    const painter = new NetworkPainter(g, net, ['Steer', 'Pedal']);
    const margin = { left: 10, right: 100, top: 10, bottom: 10 };
    painter.layout({ width: 300, height: 200, margin });
    const rec = recorder();
    painter.paint(rec.g);
    const links = g.connections.filter((c) => c.enabled).length;
    expect(rec.strokes()).toBe(links + g.nodes.length);
    for (const [x, y] of rec.points) {
      expect(x).toBeGreaterThanOrEqual(margin.left);
      expect(x).toBeLessThanOrEqual(300 - margin.right);
      expect(y).toBeGreaterThanOrEqual(margin.top);
      expect(y).toBeLessThanOrEqual(200 - margin.bottom);
    }
    expect(rec.texts.filter((t) => t === 'Steer' || t === 'Pedal')).toHaveLength(2);
    expect(rec.texts).toContain(valueText(net.values[net.nodeIds.indexOf(g.outputs[0])]));
  });

  it('labels outputs in a font a canvas accepts, with no CSS variable in it', () => {
    const g = genome();
    const painter = new NetworkPainter(g, new Network(g), ['Steer', 'Pedal']);
    painter.layout({ width: 300, height: 200, margin: { left: 10, right: 100, top: 10, bottom: 10 } });
    const rec = recorder();
    painter.paint(rec.g);
    expect(rec.raw.font).toBe('500 12px sans-serif');
    painter.setFontFamily('"GeistSans", "GeistSans Fallback", sans-serif');
    painter.paint(rec.g);
    expect(rec.raw.font).toBe('500 12px "GeistSans", "GeistSans Fallback", sans-serif');
    expect(rec.raw.font).not.toContain('var(');
  });
});
