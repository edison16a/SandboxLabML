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

  constructor(
    private readonly port: MessagePort,
    readonly stream: StreamName,
  ) {
    port.onmessage = (e: MessageEvent<StreamIn>) => {
      const msg = e.data;
      if (msg.kind === 'return') this.ring.give(msg.buffer);
      else if (msg.kind === 'subscribe' && msg.stream === stream) {
        this.inspect = msg.inspect;
        this.rays = msg.rays;
      }
    };
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
