import type { RadarAxis } from '@/engine/bench/radar';

const SIZE = 220;
const C = SIZE / 2;
const R = 72;

function point(i: number, count: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const r = R * Math.max(0, Math.min(1, value));
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
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
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-[240px]"
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
        const [x, y] = point(i, n, 1.32);
        return (
          <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--color-muted)" fontFamily="var(--font-sans)">
            {a.label} {Math.round(a.value * 100)}
          </text>
        );
      })}
    </svg>
  );
}
