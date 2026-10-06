import * as Comlink from 'comlink';
import type { CoordinatorApi } from '../coordinator/coordinator.worker';
import type { EventSink } from '../coordinator/events';
import type { ReplayApi } from '../replay/replay.worker';
import { SnapshotStream } from './snapshotStream';

export interface WorkerPool {
  coordinator: Comlink.Remote<CoordinatorApi>;
  replay: Comlink.Remote<ReplayApi>;
  population: SnapshotStream;
  ghosts: SnapshotStream;
  simCount: number;
  terminate(): void;
}

/** One sim worker per spare core: leave one for the main thread and one for the coordinator and replay. */
export function simWorkerCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  return Math.max(1, Math.min(8, cores - 2));
}

/**
 * Creates the coordinator, the sim workers and the replay worker, and wires
 * a port from the coordinator to every sim worker plus a snapshot port from
 * the live sim worker and the replay worker to the main thread.
 */
export async function createWorkerPool(onEvent: EventSink): Promise<WorkerPool> {
  const coordWorker = new Worker(new URL('../coordinator/coordinator.worker.ts', import.meta.url), { type: 'module', name: 'coordinator' });
  const replayWorker = new Worker(new URL('../replay/replay.worker.ts', import.meta.url), { type: 'module', name: 'replay' });
  const simWorkers: Worker[] = [];
  const coordPorts: MessagePort[] = [];
  const popChannel = new MessageChannel();
  const n = simWorkerCount();
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('../sim/sim.worker.ts', import.meta.url), { type: 'module', name: `sim-${i}` });
    simWorkers.push(w);
    const toCoord = new MessageChannel();
    // Only sim worker 0 runs live generations, so only it gets the real stream port.
    const streamPort = i === 0 ? popChannel.port2 : new MessageChannel().port2;
    const sim = Comlink.wrap<{ connect(a: MessagePort, b: MessagePort): void }>(w);
    await sim.connect(Comlink.transfer(toCoord.port2, [toCoord.port2]), Comlink.transfer(streamPort, [streamPort]));
    coordPorts.push(toCoord.port1);
  }
  const coordinator = Comlink.wrap<CoordinatorApi>(coordWorker);
  await coordinator.connect(Comlink.transfer(coordPorts, coordPorts), Comlink.proxy(onEvent));
  const replay = Comlink.wrap<ReplayApi>(replayWorker);
  const ghostChannel = new MessageChannel();
  await replay.connect(Comlink.transfer(ghostChannel.port2, [ghostChannel.port2]));
  return {
    coordinator,
    replay,
    population: new SnapshotStream('population', popChannel.port1),
    ghosts: new SnapshotStream('ghosts', ghostChannel.port1),
    simCount: n,
    terminate() {
      coordWorker.terminate();
      replayWorker.terminate();
      simWorkers.forEach((w) => w.terminate());
    },
  };
}
