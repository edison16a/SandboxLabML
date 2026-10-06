import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HIDESEEK_BLUEPRINTS } from '@/engine/blueprints/presets';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { boxAt } from '@/render/hideseek/frame/snapshotRead';
import { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import { Network } from '@/engine/neat/network';
import { createHideSeekRunConfig } from '@/engine/training/hideseekRunConfig';
import { hideSeekTrainerOptions } from '@/engine/training/hideseekSetup';
import { HideSeekHostCache } from '../shared/hideSeekHost';
import type { StreamOut } from '../shared/protocol';
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
  const frames: Float32Array[] = [];
  const port = {
    onmessage: null as unknown,
    postMessage(msg: StreamOut) {
      if (msg.kind !== 'frame') return;
      frames.push(msg.buffer.slice());
      sender.ring.give(msg.buffer.buffer as ArrayBuffer);
    },
  };
  const sender = new StreamSender(port as unknown as MessagePort, 'arenas');
  return { sender, frames };
}

function scene(): SandboxScene {
  const config = createHideSeekRunConfig({ name: 's', seed: 3, blueprint: HIDESEEK_BLUEPRINTS[1], populationPerTeam: 4, rounds: 1 });
  const t = HideSeekTrainer.create(hideSeekTrainerOptions(config));
  const inputs = HIDESEEK_BLUEPRINTS[1].inputs;
  return { hider: t.hiders.genomes[0], seeker: t.seekers.genomes[0], hiderInputs: inputs, seekerInputs: inputs, layout: 'open', seed: 9, reward: 'v1', physics: DEFAULT_HIDESEEK_PHYSICS, scriptSource: null };
}

describe('Sandbox', () => {
  it('moves and locks boxes mid match and shows it in the next frame', async () => {
    const { sender, frames } = capture();
    const player = new SandboxPlayer(sender, async () => pool, new HideSeekHostCache());
    await player.load(scene());
    player.moveBox(2, 3.5, -2.25);
    let last = frames[frames.length - 1];
    expect(last[boxAt(0, 2)]).toBeCloseTo(3.5, 5);
    expect(last[boxAt(0, 2) + 1]).toBeCloseTo(-2.25, 5);
    player.setBoxLocked(0, true);
    last = frames[frames.length - 1];
    expect(last[boxAt(0, 0) + 3]).toBe(1);
    player.setBoxLocked(0, false);
    expect(frames[frames.length - 1][boxAt(0, 0) + 3]).toBe(0);
    player.stop();
  });
});

describe('lesion network', () => {
  it('acts exactly like the plain network fed the forced inputs', () => {
    const genome = scene().hider;
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
