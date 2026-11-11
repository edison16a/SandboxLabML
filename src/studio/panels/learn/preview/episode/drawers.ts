import type { EnvId } from '@/engine/env/types';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { frameAt, secondsAt } from '../playback';
import { drawEpisode } from './drawEpisode';

/** How the Studio draws the lesson preview of one env added through the registry. */
export interface PreviewDrawer {
  /** Paints the frame at the playhead, in ticks. The canvas is in CSS pixels. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, preview: EpisodePreview, pos: number): void;
  /** The line under the canvas at the playhead. */
  readout?(preview: EpisodePreview, pos: number): string;
  /** One line under the preview saying what it shows. */
  caption?: string;
  /** What the canvas shows, for screen readers. */
  label?: string;
}

/**
 * The Studio's one entry per env for lesson previews. An env without a
 * row gets the shared top view (drawEpisode), which already shows the
 * agent's trail, rays and facing; a row adds its scene (streets, walls,
 * spikes) from the preview hook's `scene`. The shared drawing helpers in
 * drawEpisode.ts and pose.ts are there to build on.
 */
const DRAWERS: Partial<Record<EnvId, PreviewDrawer>> = {};

const GENERIC: Required<Omit<PreviewDrawer, 'draw'>> = {
  readout: episodeReadout,
  caption: 'The run a check plays, with a fixed test brain.',
  label: 'Top view of the test run: the trail, the agent and its rays',
};

/** The drawer for an env, with the shared parts filled in where its row leaves them out. */
export function previewDrawer(env: EnvId): Required<PreviewDrawer> {
  return { draw: drawEpisode, ...GENERIC, ...DRAWERS[env] };
}

/** Time, the reward so far and, at the end, why the run stopped. */
export function episodeReadout(p: EpisodePreview, pos: number): string {
  if (p.ticks === 0) return '';
  const { i } = frameAt(pos, p.ticks);
  const end = i === p.ticks - 1 ? `, stopped: ${p.stopReason}` : '';
  return `${secondsAt(pos, p.ticks, p.tickHz).toFixed(1)} s, reward ${p.rewards[i].toFixed(2)}${end}`;
}
