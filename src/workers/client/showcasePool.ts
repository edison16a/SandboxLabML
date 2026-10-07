import * as Comlink from 'comlink';
import type { ReplayApi } from '../replay/replay.worker';
import { SnapshotStream } from './snapshotStream';

/** The one worker behind the landing page hero, and the two streams it draws from. */
export interface ShowcasePool {
  replay: Comlink.Remote<ReplayApi>;
  /** The hero car, played as a ghost. */
  car: SnapshotStream;
  /** The Hide and Seek match, played as a Sandbox match. */
  arena: SnapshotStream;
  terminate(): void;
}

/**
 * Starts a replay worker for the landing page. It is the same worker the
 * labs use to replay champions, so the hero shows real brains driving and
 * playing, and its code is already cached when a visitor opens a lab. No
 * training workers start: nothing on the landing page learns.
 */
export async function createShowcasePool(): Promise<ShowcasePool> {
  const worker = new Worker(new URL('../replay/replay.worker.ts', import.meta.url), { type: 'module', name: 'showcase' });
  const replay = Comlink.wrap<ReplayApi>(worker);
  const ghosts = new MessageChannel();
  // Round replays need a port too, though the hero never plays one.
  const rounds = new MessageChannel();
  const sandbox = new MessageChannel();
  try {
    await replay.connect(Comlink.transfer(ghosts.port2, [ghosts.port2]));
    await replay.connectArenas(Comlink.transfer(rounds.port2, [rounds.port2]), Comlink.transfer(sandbox.port2, [sandbox.port2]));
  } catch (err) {
    worker.terminate();
    throw err;
  }
  return {
    replay,
    car: new SnapshotStream('ghosts', ghosts.port1),
    arena: new SnapshotStream('sandbox', sandbox.port1),
    terminate() {
      worker.terminate();
      for (const port of [ghosts.port1, rounds.port1, sandbox.port1]) port.close();
    },
  };
}
