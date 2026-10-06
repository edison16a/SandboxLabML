import * as Comlink from 'comlink';
import type { CoordinatorApi } from '../coordinator/coordinator.worker';
import type { HideSeekEventSink } from '../coordinator/hideSeekEvents';
import type { ReplayApi } from '../replay/replay.worker';
import { ArenaStream } from './arenaStream';
import { SnapshotStream } from './snapshotStream';
import { simWorkerCount } from './workerPool';

export interface HideSeekPool {
  coordinator: Comlink.Remote<CoordinatorApi>;
  replay: Comlink.Remote<ReplayApi>;
  /** The live round, merged from every sim worker in match order. */
  live: ArenaStream;
  /** Round replays and the Sandbox, from the replay worker. */
  replayed: SnapshotStream;
  simCount: number;
  terminate(): void;
}

/**
 * Starts the workers for the Hide and Seek lab: the coordinator, one sim
 * worker per spare core and the replay worker. Unlike Racing, where one sim
 * worker streams the live generation, every sim worker gets its own arena
 * port, because a live round is spread over all of them.
 */
export async function createHideSeekPool(onEvent: HideSeekEventSink): Promise<HideSeekPool> {
  const coordWorker = new Worker(new URL('../coordinator/coordinator.worker.ts', import.meta.url), { type: 'module', name: 'hs-coordinator' });
  const replayWorker = new Worker(new URL('../replay/replay.worker.ts', import.meta.url), { type: 'module', name: 'hs-replay' });
  const simWorkers: Worker[] = [];
  const coordPorts: MessagePort[] = [];
  const arenaPorts: MessagePort[] = [];
  const n = simWorkerCount();
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('../sim/sim.worker.ts', import.meta.url), { type: 'module', name: `hs-sim-${i}` });
    simWorkers.push(w);
    const toCoord = new MessageChannel();
    const arenas = new MessageChannel();
    // The Racing population port is required by the sim worker but unused here.
    const unused = new MessageChannel().port2;
    const sim = Comlink.wrap<{ connect(a: MessagePort, b: MessagePort, c: MessagePort): void }>(w);
    await sim.connect(Comlink.transfer(toCoord.port2, [toCoord.port2]), Comlink.transfer(unused, [unused]), Comlink.transfer(arenas.port2, [arenas.port2]));
    coordPorts.push(toCoord.port1);
    arenaPorts.push(arenas.port1);
  }
  const coordinator = Comlink.wrap<CoordinatorApi>(coordWorker);
  await coordinator.connect(Comlink.transfer(coordPorts, coordPorts), Comlink.proxy(() => {}));
  await coordinator.connectHideSeek(Comlink.proxy(onEvent));
  const replay = Comlink.wrap<ReplayApi>(replayWorker);
  const replayChannel = new MessageChannel();
  await replay.connectArenas(Comlink.transfer(replayChannel.port2, [replayChannel.port2]));
  return {
    coordinator,
    replay,
    live: new ArenaStream('arenas', arenaPorts),
    replayed: new SnapshotStream('arenas', replayChannel.port1),
    simCount: n,
    terminate() {
      coordWorker.terminate();
      replayWorker.terminate();
      simWorkers.forEach((w) => w.terminate());
    },
  };
}
