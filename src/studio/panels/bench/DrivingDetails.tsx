import type { BenchResult } from '@/engine/bench/types';

const percent = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '-' : `${Math.round(v * 100)}%`);

/**
 * The Driving exam level by level: the score of each level's four trips,
 * how many arrived and how many of those were safe. Rush hour reads low
 * for most brains, and this is where that shows.
 */
export function DrivingDetails({ result }: { result: BenchResult }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-[12px] font-semibold tracking-wide text-muted uppercase">By level</h4>
      <table className="w-full text-[12px]">
        <thead className="text-left text-subtle">
          <tr>
            <th className="py-1 font-medium">Level</th>
            <th className="py-1 text-right font-medium">Arrived</th>
            <th className="py-1 text-right font-medium">Safely</th>
            <th className="py-1 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="tabular font-mono">
          {result.parts.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="py-1.5 font-sans">{p.label}</td>
              <td className="py-1.5 text-right">{percent(p.metrics.arrived)}</td>
              <td className="py-1.5 text-right">{percent(p.metrics.safeArrivals)}</td>
              <td className="py-1.5 text-right">{Math.round(p.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-subtle">Four short trips per level, in Harbor and Old Town, which training never uses.</p>
    </section>
  );
}
