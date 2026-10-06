import { buildTrack } from '@/engine/racing/track/buildTrack';
import { circle } from '@/engine/racing/track/shapes';
import type { Track, TrackSpec } from '@/engine/racing/track/types';

const built = new WeakMap<TrackSpec, Track>();

/** The built track for a spec, made once per spec object, since several Sandbox panels read the same one. */
export function trackFor(spec: TrackSpec): Track {
  let track = built.get(spec);
  if (!track) built.set(spec, (track = buildTrack(spec)));
  return track;
}

/** True when two specs describe the same road, whatever their ids and names say. */
export function sameRoad(a: TrackSpec, b: TrackSpec): boolean {
  return a.width === b.width && a.points.length === b.points.length && a.points.every((p, i) => p[0] === b.points[i][0] && p[1] === b.points[i][1]);
}

const freshId = () => `custom-${Date.now().toString(36)}`;

/** A plain loop to start drawing from. Eight points leave few handles to drag and plenty of room to bend. */
export function blankLoop(width: number): TrackSpec {
  const points = circle(55, 8).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]);
  return { id: freshId(), name: 'Your track', width, points };
}

/**
 * The track as a new run should record it. An edited preset keeps the
 * preset's id unless renamed here, and a run would then claim to be on the
 * Oval while driving something else.
 */
export function forTraining(spec: TrackSpec, picked: TrackSpec | null): TrackSpec {
  return picked && sameRoad(spec, picked) ? spec : { ...spec, id: freshId(), name: 'Custom track' };
}

/** "My track 3": the first number not already taken, so a quick save never replaces an older track. */
export function nextTrackName(taken: readonly string[]): string {
  const names = new Set(taken.map((n) => n.toLowerCase()));
  for (let k = 1; ; k++) if (!names.has(`my track ${k}`)) return `My track ${k}`;
}
