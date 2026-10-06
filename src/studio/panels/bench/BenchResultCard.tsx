import { radarValues } from '@/engine/bench/radar';
import type { BenchReferences, BenchResult } from '@/engine/bench/types';
import { Stat } from '@/ui/primitives/Panel';
import { bandAt, percentileIn } from './percentile';
import { Radar } from './Radar';

const TIER_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

function Bar({ label, score, you }: { label: string; score: number; you?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_1fr_36px] items-center gap-2 text-[12px]">
      <span className={you ? 'font-semibold text-fg' : 'text-muted'}>{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3">
        <span className={`block h-full rounded-full ${you ? 'bg-accent' : 'bg-border-strong'}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <span className="tabular text-right font-mono">{Math.round(score)}</span>
    </div>
  );
}

interface Props {
  result: BenchResult;
  references: BenchReferences | null;
  generation: number;
}

/**
 * A benchmark score next to the reference scripts: final scores side by
 * side, the percentile among reference runs at the same generation, the
 * radar of the four axes, and the score per 100 parameters.
 */
export function BenchResultCard({ result, references, generation }: Props) {
  const refs = references && references.benchmarkVersion === result.benchmarkVersion ? references.references : [];
  const summary = [`You ${Math.round(result.score)}`, ...refs.map((r) => `${TIER_LABEL[r.tier]} ${Math.round(r.finalScore)}`)].join(', ');
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-2 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Score" value={Math.round(result.score)} hint="0 to 100, independent of the training reward" />
        <Stat label="Per 100 parameters" value={result.scorePer100Params.toFixed(1)} hint="Score for each 100 weights in the brain" />
      </div>
      <section className="flex flex-col gap-2">
        <h4 className="text-[12px] font-semibold tracking-wide text-muted uppercase">Compared with the presets</h4>
        <p className="text-[13px]">{summary}</p>
        <div className="flex flex-col gap-1.5">
          <Bar label="You" score={result.score} you />
          {refs.map((r) => (
            <Bar key={r.tier} label={TIER_LABEL[r.tier]} score={r.finalScore} />
          ))}
        </div>
        {refs.length === 0 && <p className="text-[12px] text-subtle">Reference scores for this benchmark version are not available yet.</p>}
      </section>
      {refs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[12px] font-semibold tracking-wide text-muted uppercase">At generation {generation + 1}</h4>
          <table className="w-full text-[12px]">
            <thead className="text-left text-subtle">
              <tr>
                <th className="py-1 font-medium">Reference</th>
                <th className="py-1 font-medium">Middle half</th>
                <th className="py-1 text-right font-medium">You beat</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono">
              {refs.map((r) => {
                const band = bandAt(r.curve, generation);
                return (
                  <tr key={r.tier} className="border-t border-border">
                    <td className="py-1.5 font-sans">{TIER_LABEL[r.tier]}</td>
                    <td className="py-1.5">{band ? `${Math.round(band.p25)} to ${Math.round(band.p75)}` : 'none'}</td>
                    <td className="py-1.5 text-right">{band ? `${percentileIn(result.score, band)}%` : 'none'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <Radar axes={radarValues(result.env, result.radar)} />
    </div>
  );
}
