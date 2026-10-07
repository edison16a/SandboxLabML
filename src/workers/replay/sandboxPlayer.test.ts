import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { presetRoom } from '@/engine/hideseek/sandbox/room';
import { readSandboxSnapshot, SANDBOX_OVER, sandboxCounts } from '@/engine/hideseek/sandbox/snapshot';
import { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import { Network } from '@/engine/neat/network';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { hideSeekTrainerOptions } from '@/engine/training/hideseekSetup';
import { HideSeekHostCache } from '../shared/hideSeekHost';
import type { StreamIn, StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { LesionNetwork } from './lesionNetwork';
import { SandboxPlayer, type SandboxScene } from './sandboxPlayer';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

/** A stream whose frames are copied out and whose buffers go straight back, like the main thread does. */
function capture() {
  const frames: StreamOut[] = [];
  const port = {
    onmessage: null as unknown,
    postMessage(msg: StreamOut) {
      if (msg.kind !== 'frame') return void frames.push(msg);
      frames.push({ ...msg, buffer: msg.buffer.slice() });
      sender.ring.give(msg.buffer.buffer as ArrayBuffer);
    },
  };
  const sender = new StreamSender(port as unknown as MessagePort, 'sandbox');
  const last = () => {
    const f = frames.filter((m) => m.kind === 'frame').pop();
    return f && f.kind === 'frame' ? f : null;
  };
  return { sender, frames, last };
}

function scene(hiders = 3, seekers = 2): SandboxScene {
  const config = createHideSeekRunConfig({ name: 's', seed: 3, blueprint: HIDESEEK_BLUEPRINTS[1], populationPerTeam: 4, rounds: 1 });
  const t = HideSeekTrainer.create(hideSeekTrainerOptions(config));
  const inputs = HIDESEEK_BLUEPRINTS[1].inputs;
  return {
    room: presetRoom('shelter'),
    hider: { genome: t.hiders.genomes[0], inputs, count: hiders },
    seeker: { genome: t.seekers.genomes[0], inputs, count: seekers },
    seed: 9,
    physics: DEFAULT_HIDESEEK_PHYSICS,
    scriptSource: null,
  };
}

describe('Sandbox player', () => {
  it('streams frames sized for the players and boxes, and shows edits in the next frame', async () => {
    const { sender, frames, last } = capture();
    const player = new SandboxPlayer(sender, async () => pool, new HideSeekHostCache());
    await player.load(scene(3, 2));
    expect(frames[0].kind).toBe('start');
    expect(sandboxCounts(last()!.buffer)).toEqual({ hiders: 3, seekers: 2, boxes: 5 });
    player.moveBox(2, 3.5, -2.25);
    let snap = readSandboxSnapshot(last()!.buffer);
    expect(snap.boxes[2].x).toBeCloseTo(3.5, 5);
    expect(snap.boxes[2].z).toBeCloseTo(-2.25, 5);
    player.setBoxLocked(0, true);
    expect(readSandboxSnapshot(last()!.buffer).boxes[0].locked).toBe(true);
    player.setBoxLocked(0, false);
    expect(readSandboxSnapshot(last()!.buffer).boxes[0].locked).toBe(false);

    await player.load(scene(8, 6));
    snap = readSandboxSnapshot(last()!.buffer);
    expect([snap.hiders.length, snap.seekers.length]).toEqual([8, 6]);
    player.stop();
  });

  it('lesions an input for every player of a team, and keeps it across a restart', async () => {
    const { sender, last } = capture();
    const player = new SandboxPlayer(sender, async () => pool, new HideSeekHostCache());
    await player.load(scene(2, 3));
    player.setLesion(1, 0, 0.25);
    sender.inspect = 1;
    await player.restart();
    // Brains first see inputs on the first tick, so let it play a few.
    player.setPaused(false);
    await new Promise((r) => setTimeout(r, 300));
    player.setPaused(true);
    expect(last()!.tick).toBeGreaterThan(0);
    const inspect = last()!.inspect;
    expect(inspect?.index).toBe(1);
    expect(inspect?.obs[0]).toBeCloseTo(0.25, 6);
    player.stop();
  });
});

describe('Sandbox player end of match', () => {
  it('delivers the frame that ends a match even when the page held every buffer as it ended', async () => {
    const frames: StreamOut[] = [];
    // A page that keeps every buffer until the test hands one back, like a main thread busy drawing.
    const port = {
      onmessage: null as ((e: { data: StreamIn }) => void) | null,
      postMessage(msg: StreamOut) {
        frames.push(msg.kind === 'frame' ? { ...msg, buffer: msg.buffer.slice() } : msg);
      },
    };
    const sender = new StreamSender(port as unknown as MessagePort, 'sandbox');
    const player = new SandboxPlayer(sender, async () => pool, new HideSeekHostCache());
    await player.load({ ...scene(1, 1), physics: { ...DEFAULT_HIDESEEK_PHYSICS, matchSeconds: 2 } });
    const held = [sender.ring.take(), sender.ring.take()];
    player.setSpeed(Infinity);
    player.setPaused(false);
    await new Promise((r) => setTimeout(r, 1000));
    const over = () => frames.filter((m) => m.kind === 'frame' && m.buffer[SANDBOX_OVER] === 1);
    expect(over()).toHaveLength(0);
    port.onmessage?.({ data: { kind: 'return', buffer: held[0]!.buffer as ArrayBuffer } });
    expect(over()).toHaveLength(1);
    // Later buffers are only recycled: the end goes out once.
    port.onmessage?.({ data: { kind: 'return', buffer: held[1]!.buffer as ArrayBuffer } });
    expect(over()).toHaveLength(1);
    player.stop();
  });
});

describe('lesion network', () => {
  it('acts exactly like the plain network fed the forced inputs', () => {
    const genome = scene().hider.genome;
    const plain = new Network(genome);
    const lesioned = new LesionNetwork(genome);
    const obs = Float64Array.from({ length: plain.inputCount }, (_, i) => Math.sin(i * 1.7));
    lesioned.setLesion(3, 0);
    lesioned.setLesion(10, 0.25);
    const forced = obs.slice();
    forced[3] = 0;
    forced[10] = 0.25;
    const a = new Float64Array(4);
    const b = new Float64Array(4);
    plain.activate(forced, a);
    lesioned.activate(obs, b);
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(lesioned.effective[10]).toBe(0.25);
    lesioned.clearLesions();
    lesioned.activate(obs, b);
    plain.activate(obs, a);
    expect(Array.from(b)).toEqual(Array.from(a));
  });
});
