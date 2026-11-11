import { episodeInfo } from '../env/registry';
import type { EnvId } from '../env/types';
import { RACING_RADAR_AXES } from './racingAxes';
import type { BenchRadar, HideSeekRadar, RacingRadar } from './types';

/** One radar axis: the key in the result's radar and the label the chart prints. */
export interface RadarAxis<K extends string = string> {
  key: K;
  label: string;
}

/**
 * The radar axes of each environment, in drawing order (clockwise from the
 * top). Racing keeps its original order, so its chart looks as it always did.
 */
export const RADAR_AXES: { racing: ReadonlyArray<RadarAxis<keyof RacingRadar>>; hideseek: ReadonlyArray<RadarAxis<keyof HideSeekRadar>> } = {
  racing: RACING_RADAR_AXES,
  hideseek: [
    { key: 'hiding', label: 'Hiding' },
    { key: 'seeking', label: 'Seeking' },
    { key: 'cover', label: 'Cover' },
    { key: 'generalization', label: 'Generalization' },
  ],
};

/**
 * A result's radar as labeled values, ready to draw. The env picks the
 * axes, and an axis the radar lacks reads as 0 rather than breaking the
 * chart, which can happen with a result saved by an older build.
 */
export function radarValues(env: EnvId, radar: BenchRadar): Array<RadarAxis & { value: number }> {
  const values = radar as unknown as Record<string, number | undefined>;
  return radarAxesOf(env).map((axis) => ({ key: axis.key, label: axis.label, value: values[axis.key] ?? 0 }));
}

/** An env's radar axes: Hide and Seek's own, or the ones its env module's benchmark declares. */
export function radarAxesOf(env: EnvId): ReadonlyArray<RadarAxis> {
  return env === 'hideseek' ? RADAR_AXES.hideseek : (episodeInfo(env)?.bench?.axes ?? []);
}
