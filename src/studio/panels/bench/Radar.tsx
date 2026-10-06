import type { BenchRadar } from '@/engine/bench/types';

const AXES: ReadonlyArray<[keyof BenchRadar, string]> = [
  ['speed', 'Speed'],
  ['completion', 'Completion'],
  ['smoothness', 'Smoothness'],
  ['generalization', 'Generalization'],
];

const SIZE = 220;
const C = SIZE / 2;
const R = 72;

function point(i: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  const r = R * Math.max(0, Math.min(1, value));
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
}

/** The four benchmark axes as a small inline SVG radar, each from 0 at the center to 1 at the rim. */
export function Radar({ radar }: { radar: BenchRadar }) {
  const shape = AXES.map(([k], i) => point(i, radar[k]).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto w-full max-w-[240px]" role="img" aria-label={AXES.map(([k, l]) => `${l} ${Math.round(radar[k] * 100)}%`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon key={ring} points={AXES.map((_, i) => point(i, ring).join(',')).join(' ')} fill="none" stroke="var(--color-border)" strokeWidth={1} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill="#4c9aff33" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
      {AXES.map(([k, label], i) => {
        const [x, y] = point(i, 1.32);
        return (
          <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--color-muted)" fontFamily="var(--font-sans)">
            {label} {Math.round(radar[k] * 100)}
          </text>
        );
      })}
    </svg>
  );
}
