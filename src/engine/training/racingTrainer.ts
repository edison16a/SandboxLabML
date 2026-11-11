import { racingModule } from '../racing/module';
import type { RacingResult } from '../racing/result';
import { buildTrack } from '../racing/track/buildTrack';
import type { Track, TrackSpec } from '../racing/track/types';
import { EpisodeTrainer, type EpisodeTrainerState } from './episodeTrainer';
import type { RacingSetup } from './racingSetup';
import type { RacingChampionRecord } from './records';
import type { RunConfig } from './runConfig';

/** Racing checkpoints: the generic state with the track as content. */
export type RacingTrainerState = EpisodeTrainerState<TrackSpec>;

/**
 * Racing training: the generic episode trainer bound to the Racing module.
 * It adds the built track, which the lessons and the hero training read.
 */
export class RacingTrainer extends EpisodeTrainer<RacingSetup, TrackSpec, RacingResult, RacingChampionRecord> {
  private built: { spec: TrackSpec; track: Track } | null = null;

  constructor(config: RunConfig, state?: RacingTrainerState) {
    super(racingModule, config, state);
  }

  /** The road the population drives on now, built once per track. */
  get track(): Track {
    const spec = this.content;
    if (this.built?.spec !== spec) this.built = { spec, track: buildTrack(spec) };
    return this.built.track;
  }
}
