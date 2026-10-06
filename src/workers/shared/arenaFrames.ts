import { HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekMatch } from '@/engine/hideseek/match/match';
import { HIDESEEK_RAY_SNAPSHOT, HIDESEEK_SNAPSHOT } from '@/engine/hideseek/snapshot';
import type { InspectPayload, StreamPart } from './protocol';
import type { StreamSender } from './streamPort';

const STRIDE = HIDESEEK_SNAPSHOT.stride;
const RAY_STRIDE = HIDESEEK_RAY_SNAPSHOT.stride;

/** Reads an agent's latest observation. The Sandbox swaps in one that shows its lesions. */
export type ObservationReader = (match: HideSeekMatch, agent: number) => ArrayLike<number>;

/**
 * Streams Hide and Seek arenas to the main thread: 28 floats per arena,
 * optional ray hit points, and the inputs of one inspected agent. The
 * inspected agent is addressed as arena * 2 + agent (0 hider, 1 seeker)
 * across the whole merged stream, so the main thread does not need to know
 * which worker owns which arena.
 */
export class ArenaFrameWriter {
  private part: StreamPart = { first: 0, total: 0, epoch: 0 };
  private generation = 0;

  constructor(
    private readonly stream: StreamSender,
    private readonly observe: ObservationReader = (m, agent) => m.observation(agent),
  ) {}

  /** Announces a new episode. Each arena is tagged with its layout index so the renderer can draw its walls. */
  begin(matches: HideSeekMatch[], part: StreamPart, generation: number): void {
    this.part = part;
    this.generation = generation;
    this.stream.ring.resize(Math.max(1, matches.length) * STRIDE);
    const tags = Int32Array.from(matches, (m) => HIDESEEK_LAYOUT_IDS.indexOf(m.state.arena.layout.id));
    this.stream.send({ kind: 'start', stream: this.stream.stream, generation, count: matches.length, tags, part });
  }

  /** Sends one frame of every match. Dropped quietly when the main thread still holds every buffer. */
  send(matches: HideSeekMatch[], tick: number): void {
    const buffer = this.stream.ring.take();
    if (!buffer) return;
    for (let i = 0; i < matches.length; i++) matches[i].snapshot(buffer, i * STRIDE);
    let rays: Float32Array | undefined;
    if (this.stream.rays) {
      rays = new Float32Array(matches.length * RAY_STRIDE);
      for (let i = 0; i < matches.length; i++) matches[i].snapshotRays(rays, i * RAY_STRIDE);
    }
    const inspect = this.inspected(matches);
    this.stream.send({ kind: 'frame', stream: this.stream.stream, generation: this.generation, tick, count: matches.length, buffer, inspect, rays, part: this.part });
  }

  /** Ends the episode, so the main thread knows no more frames are coming. */
  end(): void {
    this.stream.send({ kind: 'end', stream: this.stream.stream, generation: this.generation });
  }

  private inspected(matches: HideSeekMatch[]): InspectPayload | undefined {
    const want = this.stream.inspect;
    if (want === null || want < 0) return undefined;
    const arena = Math.floor(want / 2) - this.part.first;
    if (arena < 0 || arena >= matches.length) return undefined;
    const agent = want % 2;
    const m = matches[arena];
    const c = m.state.controls[agent];
    return { index: want, obs: Float32Array.from(this.observe(m, agent)), out: Float32Array.from([c.move, c.turn, c.grab ? 1 : -1, c.lock ? 1 : -1]) };
  }
}
