import { ENGINE_VERSION } from '@/engine/core/version';
import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { HideSeekRecord, RoundReplay } from '@/engine/training/hideseekRecords';
import type { RunConfig } from '@/engine/training/runConfig';
import { latestCheckpoint } from '@/storage/checkpoints';
import { deleteHideSeekGenerationsFrom, loadHideSeekHistory } from '@/storage/hideSeekGenerations';
import { getRun } from '@/storage/runs';

/** A stored run, ready to hand to the coordinator. */
export interface LoadedRun {
  config: RunConfig;
  /** Generations before the resume point, replays stripped (the newest one is kept apart). */
  history: HideSeekRecord[];
  latestReplay: RoundReplay | null;
  state?: HideSeekTrainerState;
}

/**
 * Opens a run the way Racing does: resume from the newest checkpoint and
 * drop any generations recorded after it, since training is deterministic
 * and will produce them again. With no checkpoint the run restarts from
 * scratch. Returns null for a missing run or one of another environment.
 */
export async function loadHideSeekRun(runId: string): Promise<LoadedRun | null> {
  const run = await getRun(runId);
  if (!run || run.env !== 'hideseek') return null;
  const checkpoint = await latestCheckpoint(runId);
  let history = await loadHideSeekHistory(runId);
  if (checkpoint) {
    await deleteHideSeekGenerationsFrom(runId, checkpoint.generation);
    history = history.filter((r) => r.generation < checkpoint.generation);
  } else if (history.length) {
    await deleteHideSeekGenerationsFrom(runId, 0);
    history = [];
  }
  const split = splitReplays(history);
  return { config: run.config, history: split.records, latestReplay: split.latest, state: checkpoint?.state as HideSeekTrainerState | undefined };
}

/**
 * Records stay in the store for the whole session, so they must not carry a
 * round of genomes each. The newest replay is kept apart for the viewport.
 */
export function splitReplays(records: HideSeekRecord[]): { records: HideSeekRecord[]; latest: RoundReplay | null } {
  let latest: RoundReplay | null = null;
  const out = records.map((r) => {
    if (!r.replay) return r;
    latest = r.replay;
    const rest = { ...r };
    delete rest.replay;
    return rest;
  });
  return { records: out, latest };
}

/** Why stored brains of this run cannot be replayed, or null when they can. */
export function replayBlockedReason(config: RunConfig): string | null {
  return config.engineVersion === ENGINE_VERSION ? null : 'This run was trained on an older engine, so its rounds cannot be replayed.';
}
