import type { HideSeekInputConfig } from '../hideseek/inputConfig';
import type { HideSeekLayoutId } from '../hideseek/layouts/types';
import type { MatchSpec } from '../hideseek/match/types';
import { DEFAULT_HIDESEEK_PHYSICS, type HideSeekPhysics } from '../hideseek/physics';
import type { HideSeekRewardId } from '../hideseek/rewards';
import type { HideSeekGenerationStats } from '../hideseek/trainer/types';
import type { Genome } from '../neat/types';

/** Most arenas the grid shows, so a stored replay never keeps more matches than that. */
export const REPLAY_MATCH_LIMIT = 50;

/** One stored match: its room and seed, and which stored genomes played it. */
export interface ReplayMatch {
  layout: HideSeekLayoutId;
  seed: number;
  /** Index into `RoundReplay.genomes`. */
  hider: number;
  seeker: number;
  /** Prep length when the match overrode it, s. */
  prepSeconds?: number;
  /** Sparring matches put a scripted agent on one side. */
  hiderScripted?: boolean;
  seekerScripted?: boolean;
}

/**
 * Everything needed to play one round again exactly, as plain data. Genomes
 * are stored once even when several matches share them (hall of fame
 * opponents often do), which keeps a stored round small.
 */
export interface RoundReplay {
  generation: number;
  /** 0 based round within the generation, and how many the generation had. */
  round: number;
  rounds: number;
  genomes: Genome[];
  matches: ReplayMatch[];
  hiderInputs: HideSeekInputConfig;
  seekerInputs: HideSeekInputConfig;
  reward: HideSeekRewardId;
  physics: HideSeekPhysics;
  /** The script the round ran under, or null for built-in rewards. */
  scriptSource: string | null;
}

/** One finished generation, as the lab shows it and storage keeps it. */
export interface HideSeekRecord {
  runId: string;
  generation: number;
  stats: HideSeekGenerationStats;
  hiderChampion: Genome;
  seekerChampion: Genome;
  /** The last round, for the Turbo grid. Only the newest few generations keep it. */
  replay?: RoundReplay;
  /** Seconds of play across every match of the generation. */
  simSeconds: number;
  wallMs: number;
}

export interface ReplayInfo {
  generation: number;
  round: number;
  rounds: number;
  scriptSource: string | null;
}

/**
 * Packs the first `limit` matches of a planned round into a replay.
 * Genomes are deduplicated by identity, which holds because every spec of a
 * plan points at the same population and hall of fame objects.
 */
export function buildRoundReplay(round: MatchSpec[], info: ReplayInfo, limit = REPLAY_MATCH_LIMIT): RoundReplay {
  if (!round.length) throw new Error('A round needs at least one match.');
  const genomes: Genome[] = [];
  const index = new Map<Genome, number>();
  const ref = (g: Genome) => {
    let i = index.get(g);
    if (i === undefined) {
      i = genomes.push(g) - 1;
      index.set(g, i);
    }
    return i;
  };
  const matches = round.slice(0, limit).map((s) => ({
    layout: s.layout,
    seed: s.seed,
    hider: ref(s.hider.genome),
    seeker: ref(s.seeker.genome),
    ...(s.prepSeconds !== undefined ? { prepSeconds: s.prepSeconds } : {}),
    ...(s.hider.scripted ? { hiderScripted: true } : {}),
    ...(s.seeker.scripted ? { seekerScripted: true } : {}),
  }));
  const first = round[0];
  return {
    ...info,
    genomes,
    matches,
    hiderInputs: first.hider.inputs,
    seekerInputs: first.seeker.inputs,
    reward: first.reward ?? 'v1',
    physics: first.physics ?? DEFAULT_HIDESEEK_PHYSICS,
  };
}

/** Turns a stored replay back into match specs, in the order they were played. */
export function replaySpecs(replay: RoundReplay): MatchSpec[] {
  return replay.matches.map((m, index) => ({
    layout: m.layout,
    seed: m.seed,
    hider: { genome: replay.genomes[m.hider], inputs: replay.hiderInputs, slot: -1, ...(m.hiderScripted ? { scripted: true } : {}) },
    seeker: { genome: replay.genomes[m.seeker], inputs: replay.seekerInputs, slot: -1, ...(m.seekerScripted ? { scripted: true } : {}) },
    ...(m.prepSeconds !== undefined ? { prepSeconds: m.prepSeconds } : {}),
    reward: replay.reward,
    physics: replay.physics,
    round: replay.round,
    index,
  }));
}
