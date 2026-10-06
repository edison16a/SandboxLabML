import { describe, expect, it } from 'vitest';
import { BUILT_IN_TRACKS, RING_TRACK } from '@/engine/racing/track/presets';
import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';
import { placedTelemetry } from './labStore';

const line: GhostTelemetry = { generation: 3, slot: 0, distance: new Float32Array(1), speed: new Float32Array(1), brake: new Float32Array(1), crash: { x: 1, y: 2, driven: 40 } };

describe('placed telemetry', () => {
  it('shows Sandbox telemetry only on the track it was timed on', () => {
    const timed = { mode: 'sandbox' as const, sandboxTrack: RING_TRACK, telemetry: [line], telemetryTrack: RING_TRACK };
    expect(placedTelemetry(timed)).toEqual([line]);
    expect(placedTelemetry({ ...timed, sandboxTrack: BUILT_IN_TRACKS[0] })).toEqual([]);
    // An edit makes a new track object, even when the shape barely moved.
    expect(placedTelemetry({ ...timed, sandboxTrack: { ...RING_TRACK } })).toEqual([]);
  });

  it('keeps training telemetry apart from what the Sandbox timed', () => {
    expect(placedTelemetry({ mode: 'train', sandboxTrack: null, telemetry: [line], telemetryTrack: null })).toEqual([line]);
    expect(placedTelemetry({ mode: 'train', sandboxTrack: RING_TRACK, telemetry: [line], telemetryTrack: RING_TRACK })).toEqual([]);
    expect(placedTelemetry({ mode: 'sandbox', sandboxTrack: RING_TRACK, telemetry: [line], telemetryTrack: null })).toEqual([]);
  });
});
