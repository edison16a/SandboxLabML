/**
 * Message shapes for the snapshot streams. Commands go through Comlink, but
 * snapshots go straight from a worker to the main thread on a dedicated
 * MessagePort as transferable buffers, so a busy coordinator never delays
 * a frame.
 */

export type StreamName = 'population' | 'ghosts' | 'arenas';

export type SpeedMode = '1x' | '2x' | '4x' | 'turbo' | 'max';

export const WATCH_SPEEDS: Record<SpeedMode, number> = { '1x': 1, '2x': 2, '4x': 4, turbo: Infinity, max: Infinity };

export function isWatchSpeed(mode: SpeedMode): boolean {
  return Number.isFinite(WATCH_SPEEDS[mode]);
}

/** Per-agent extras the main thread asked for while inspecting. */
export interface InspectPayload {
  index: number;
  obs: Float32Array;
  out: Float32Array;
}

export type StreamOut =
  | {
      kind: 'start';
      stream: StreamName;
      generation: number;
      count: number;
      /** Optional per-agent tags, e.g. species id for coloring or ghost generation. */
      tags?: Int32Array;
    }
  | {
      kind: 'frame';
      stream: StreamName;
      generation: number;
      tick: number;
      count: number;
      buffer: Float32Array;
      inspect?: InspectPayload;
      /** Normalized ray readings for every agent, rays per agent = rays.length / count. */
      rays?: Float32Array;
    }
  | { kind: 'end'; stream: StreamName; generation: number };

export type StreamIn =
  | { kind: 'return'; buffer: ArrayBuffer }
  | { kind: 'subscribe'; stream: StreamName; inspect: number | null; rays: boolean };
