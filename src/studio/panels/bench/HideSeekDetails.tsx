import type { BenchReferences, BenchResult } from '@/engine/bench/types';
import { Stat } from '@/ui/primitives/Panel';

const TIER_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;
const pct = (v: number | undefined) => (v === undefined ? 'none' : `${Math.round(v * 100)}%`);

/**
 * The Hide and Seek numbers behind the score: the Elo-style rating next to
 * the references' own ratings, and how the pair did against each reference
 * champion. Hidden is the share of seek time the model's hider stayed out
 * of sight, seen the share its seeker had the other hider in sight.
 */
export function HideSeekDetails({ result, references }: { result: BenchResult; references: BenchReferences | null }) {
  const m = result.metrics;
  const ratings = references?.benchmarkVersion === result.benchmarkVersion ? (references.champions ?? []) : [];
  const versus = result.parts.filter((p) => p.id.startsWith('vs:'));
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Rating" value={Math.round(m.elo ?? 0)} hint="Elo-style rating against the reference champions" />
        <Stat label="Hidden" value={pct(m.hiddenShare)} hint="Share of seek time your hider stayed out of sight" />
        <Stat label="Seen" value={pct(m.seenShare)} hint="Share of seek time your seeker had the hider in sight" />
      </div>
      {ratings.length > 0 && <p className="text-[12px] text-muted">Reference ratings: {ratings.map((c) => `${TIER_LABEL[c.tier]} ${Math.round(c.rating)}`).join(', ')}.</p>}
      <table className="w-full text-[12px]">
        <thead className="text-left text-subtle">
          <tr>
            <th className="py-1 font-medium">Against</th>
            <th className="py-1 text-right font-medium">Won</th>
            <th className="py-1 text-right font-medium">Hidden</th>
            <th className="py-1 text-right font-medium">Seen</th>
          </tr>
        </thead>
        <tbody className="tabular font-mono">
          {versus.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="py-1.5 font-sans">{TIER_LABEL[p.id.slice('vs:'.length) as keyof typeof TIER_LABEL] ?? p.label}</td>
              <td className="py-1.5 text-right">{pct(p.metrics.winRate)}</td>
              <td className="py-1.5 text-right">{pct(p.metrics.hiddenShare)}</td>
              <td className="py-1.5 text-right">{pct(p.metrics.seenShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-subtle">Won counts games, each a match as hider and one as seeker from the same start. A draw counts half.</p>
    </section>
  );
}
