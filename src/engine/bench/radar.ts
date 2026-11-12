import { episodeInfo } from '../env/registry';
import type { EnvId } from '../env/types';
import type { BenchRadar } from './types';

/** One radar axis: the key in the result's radar and the label the chart prints. */
export interface RadarAxis<K extends string = string> {
  key: K;
  label: string;
}

/**
 * A result's radar as labeled values, ready to draw. The env picks the
 * axes, and an axis the radar lacks reads as 0 rather than breaking the
 * chart, which can happen with a result saved by an older build.
 */
export function radarValues(env: EnvId, radar: BenchRadar): Array<RadarAxis & { value: number }> {
  const values = radar as unknown as Record<string, number | undefined>;
  return radarAxesOf(env).map((axis) => ({ key: axis.key, label: axis.label, value: values[axis.key] ?? 0 }));
}

/** An env's radar axes, in drawing order (clockwise from the top), as its module's benchmark declares them. */
export function radarAxesOf(env: EnvId): ReadonlyArray<RadarAxis> {
  return episodeInfo(env)?.bench?.axes ?? [];
}
