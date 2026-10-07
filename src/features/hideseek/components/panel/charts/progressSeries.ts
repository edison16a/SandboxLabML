import type { HideSeekGenerationStats } from '@/engine/hideseek/trainer/types';
import { HS_COLORS } from '@/render/hideseek/colors';
import type { Series } from './HsLineChart';

/** Chart colors: the team colors, amber for the boxes, jade (the ramp color) for climbing, grey for context. */
export const PROGRESS_COLORS = { hider: HS_COLORS.hider, seeker: HS_COLORS.seeker, amber: '#ffb547', jade: HS_COLORS.ramp, muted: '#8a94a7' } as const;

const C = PROGRESS_COLORS;

/** A legend chip for a series: its label, color and whether its line is dashed. */
export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export const legendOf = (series: readonly Series[]): LegendItem[] => series.map((s) => ({ label: s.label, color: s.color, dashed: !!s.dash }));

type Game = HideSeekGenerationStats['game'];

/**
 * The Box use and Ramps charts of the progress panel, from the run's
 * history. Both teams lock now, so locks are drawn per team. A history
 * from before ramps has no per team locks, and then the chart keeps the
 * single locks line it always had. Ramps is null until some generation
 * carries climbing numbers, so an old run shows no empty chart.
 */
export function boxAndRampSeries(records: ReadonlyArray<{ stats: HideSeekGenerationStats }>): { boxes: Series[]; ramps: Series[] | null } {
  const game = records.map((r) => r.stats.game);
  const opt = (pick: (g: Game) => number | undefined) => game.map((g) => pick(g) ?? null);
  const teamLocks = game.some((g) => g.hiderLocksPerMatch !== undefined);
  const locks: Series[] = teamLocks
    ? [
        { label: 'Hider locks', color: C.hider, values: opt((g) => g.hiderLocksPerMatch), width: 2 },
        { label: 'Seeker locks', color: C.seeker, values: opt((g) => g.seekerLocksPerMatch), width: 2 },
      ]
    : [{ label: 'Locks', color: C.amber, values: game.map((g) => g.locksPerMatch), width: 2 }];
  const boxes: Series[] = [
    ...locks,
    { label: 'Grabs', color: C.amber, values: game.map((g) => g.grabsPerMatch), dash: [4, 4], width: 1.25 },
    { label: 'Boxes moved', color: C.muted, values: game.map((g) => g.boxesMovedPerMatch), width: 1.25 },
  ];
  const climbing = game.some((g) => g.climbsPerMatch !== undefined);
  const ramps: Series[] | null = climbing
    ? [
        { label: 'Climbs', color: C.jade, values: opt((g) => g.climbsPerMatch), width: 1.5, fill: true },
        { label: 'Hider vaults', color: C.hider, values: opt((g) => g.hiderVaultsPerMatch), width: 2 },
        { label: 'Seeker vaults', color: C.seeker, values: opt((g) => g.seekerVaultsPerMatch), width: 2 },
      ]
    : null;
  return { boxes, ramps };
}
