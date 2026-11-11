import type { RadarAxis } from '@/engine/bench/radar';

const SIZE = 220;
const C = SIZE / 2;
const R = 72;
/** Room on each side for the side labels, in chart units. */
const PAD = 40;

/** Where axis i reaches `share` of the radius, from the top clockwise. */
function at(i: number, count: number, share: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
  return [C + R * share * Math.cos(angle), C + R * share * Math.sin(angle)];
}

/** A value on axis i, clamped to the rim. */
function point(i: number, count: number, value: number): [number, number] {
  return at(i, count, Math.max(0, Math.min(1, value)));
}

/**
 * Benchmark axes as a small inline SVG radar, each from 0 at the center to
 * 1 at the rim. The axes come from the result's environment (see
 * radarValues), so Racing and Hide and Seek share the chart.
 */
export function Radar({ axes }: { axes: ReadonlyArray<RadarAxis & { value: number }> }) {
  const n = axes.length;
  const shape = axes.map((a, i) => point(i, n, a.value).join(',')).join(' ');
  return (
    <svg
      viewBox={`${-PAD} 0 ${SIZE + 2 * PAD} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-[320px]"
      role="img"
      aria-label={axes.map((a) => `${a.label} ${Math.round(a.value * 100)}%`).join(', ')}
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon key={ring} points={axes.map((_, i) => point(i, n, ring).join(',')).join(' ')} fill="none" stroke="var(--color-border)" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, n, 1);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill="#4c9aff33" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = at(i, n, 1.12);
        // Labels at the sides grow away from the chart, so a long one such as Generalization never runs off the edge.
        const anchor = x < C - 1 ? 'end' : x > C + 1 ? 'start' : 'middle';
        const dy = anchor === 'middle' ? (y < C ? -6 : 6) : 0;
        return (
          <text key={a.key} x={x} y={y + dy} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="var(--color-muted)" fontFamily="var(--font-sans)">
            {a.label} {Math.round(a.value * 100)}
          </text>
        );
      })}
    </svg>
  );
}
