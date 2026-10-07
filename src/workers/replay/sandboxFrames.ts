import { HIDER } from '@/engine/hideseek/agents/agent';
import type { SandboxMatch } from '@/engine/hideseek/sandbox/match';
import { sandboxSnapshotLength } from '@/engine/hideseek/sandbox/snapshot';
import type { InspectPayload } from '../shared/protocol';
import type { StreamSender } from '../shared/streamPort';

/** Reads what a player's brain received last tick. The Sandbox player swaps in lesioned inputs. */
export type SlotObservation = (match: SandboxMatch, slot: number) => ArrayLike<number>;

/**
 * Streams a Sandbox match to the main thread on its own port. One frame is
 * one match (see writeSandboxSnapshot); its length follows the number of
 * players and boxes, so the buffer ring is resized whenever a match loads.
 *
 * The inspected agent is addressed as team (0 hider, 1 seeker), the way
 * the lab addresses the one arena it shows, and the payload is the first
 * player of that team.
 */
export class SandboxFrameWriter {
  private epoch = 0;
  /** Tick of the last frame that went out, so the frame that ends a match is not sent twice. */
  private sentTick = -1;

  constructor(
    private readonly stream: StreamSender,
    private readonly observe: SlotObservation,
  ) {}

  /** Announces a new match, so the main thread drops frames of the old one. */
  begin(match: SandboxMatch, epoch: number): void {
    const s = match.state;
    this.epoch = epoch;
    this.cancel();
    this.stream.ring.resize(sandboxSnapshotLength(s.agents.length, s.boxes.length));
    this.stream.send({ kind: 'start', stream: this.stream.stream, generation: epoch, count: 1, tags: new Int32Array(1) });
  }

  /** Sends the current frame. Dropped quietly, returning false, when the main thread still holds every buffer. */
  send(match: SandboxMatch): boolean {
    const buffer = this.stream.ring.take();
    if (!buffer) return false;
    match.snapshot(buffer);
    this.stream.send({ kind: 'frame', stream: this.stream.stream, generation: this.epoch, tick: match.tick, count: 1, buffer, inspect: this.inspected(match) });
    this.sentTick = match.tick;
    return true;
  }

  /**
   * Sends the frame that ends a match. A frame mid match may be dropped,
   * but this one must arrive: it is the only one that says the match is
   * over, and the landing hero waits for it to start the next match. So
   * when the main thread still holds every buffer, it goes out as soon as
   * one comes back.
   */
  sendLast(match: SandboxMatch): void {
    if (this.sentTick === match.tick || this.send(match)) return;
    this.stream.whenFree(() => this.sendLast(match));
  }

  /** Forgets a last frame still waiting for a buffer, once its match is gone. */
  cancel(): void {
    this.sentTick = -1;
    this.stream.whenFree(null);
  }

  private inspected(match: SandboxMatch): InspectPayload | undefined {
    const want = this.stream.inspect;
    if (want === null || want < 0 || want > 1) return undefined;
    const s = match.state;
    const slot = want === HIDER ? 0 : s.hiders;
    if (slot >= s.agents.length || (want === HIDER && s.hiders === 0)) return undefined;
    const c = s.controls[slot];
    return { index: want, obs: Float32Array.from(this.observe(match, slot)), out: Float32Array.from([c.move, c.turn, c.grab ? 1 : -1, c.lock ? 1 : -1]) };
  }
}
