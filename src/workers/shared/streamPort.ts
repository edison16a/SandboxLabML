import type { StreamIn, StreamName, StreamOut } from './protocol';
import { BufferRing } from './bufferRing';

/**
 * Worker side of a snapshot stream. Owns the buffer ring and the current
 * subscription (which agent is inspected, whether rays are wanted).
 */
export class StreamSender {
  readonly ring = new BufferRing(8);
  inspect: number | null = null;
  rays = false;
  /** Waits for the next buffer the main thread hands back. See whenFree. */
  private onFree: (() => void) | null = null;

  constructor(
    private readonly port: MessagePort,
    readonly stream: StreamName,
  ) {
    port.onmessage = (e: MessageEvent<StreamIn>) => {
      const msg = e.data;
      if (msg.kind === 'return') {
        this.ring.give(msg.buffer);
        const fn = this.onFree;
        this.onFree = null;
        fn?.();
      } else if (msg.kind === 'subscribe' && msg.stream === stream) {
        this.inspect = msg.inspect;
        this.rays = msg.rays;
      }
    };
  }

  /**
   * Runs `fn` once, when the main thread next hands a buffer back, for a
   * frame that must not be dropped. One waits at a time; null cancels it.
   */
  whenFree(fn: (() => void) | null): void {
    this.onFree = fn;
  }

  send(msg: StreamOut): void {
    if (msg.kind === 'frame') {
      const transfer: Transferable[] = [msg.buffer.buffer as ArrayBuffer];
      if (msg.inspect) transfer.push(msg.inspect.obs.buffer as ArrayBuffer, msg.inspect.out.buffer as ArrayBuffer);
      if (msg.rays) transfer.push(msg.rays.buffer as ArrayBuffer);
      this.port.postMessage(msg, transfer);
    } else {
      this.port.postMessage(msg);
    }
  }
}
