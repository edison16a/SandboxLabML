import { describe, expect, it } from 'vitest';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { RacingTrainer } from '@/engine/training/racingTrainer';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import type { StreamOut } from '../shared/protocol';
import { StreamSender } from '../shared/streamPort';
import { GhostPlayer, type GhostSpec } from './ghostPlayer';

const STRIDE = RACING_SNAPSHOT.stride;

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
  const sender = new StreamSender(port as unknown as MessagePort, 'ghosts');
  return { sender, frames };
}

function scene() {
  const config = createRacingRunConfig({ name: 'g', seed: 5, blueprint: RACING_BLUEPRINTS[2], track: BUILT_IN_TRACKS[0], carPreset: 'standard', populationSize: 10 });
  const trainer = new RacingTrainer(config);
  const ghost = (generation: number, slot: number): GhostSpec => ({ generation, genome: trainer.genomes[generation], seed: 40 + generation, scriptSource: null, slot });
  return { setup: trainer.setup(), ghost };
}

describe('ghost player grid', () => {
  it('draws one telemetry line per car, in stream order, with its grid slot', () => {
    const { setup, ghost } = scene();
    const field = new GhostPlayer(capture().sender);
    field.setScene(setup, [ghost(1, 3), ghost(2, 2), ghost(2, 1), ghost(2, 0)]);
    const lone = new GhostPlayer(capture().sender);
    lone.setScene(setup, [ghost(2, 0)]);
    const lines = field.telemetry();
    expect(lines.map((t) => [t.generation, t.slot])).toEqual([[1, 3], [2, 2], [2, 1], [2, 0]]);
    // The pole car drives exactly the lap it would drive alone, and back slots start behind the line.
    expect(Array.from(lines[3].distance)).toEqual(Array.from(lone.telemetry()[0].distance));
    expect(lines[0].distance[0]).toBeLessThan(-10);
  });

  it('starts copies of one champion on separate grid slots', async () => {
    const { setup, ghost } = scene();
    const { sender, frames } = capture();
    const player = new GhostPlayer(sender);
    player.setScene(setup, [ghost(3, 2), ghost(3, 1), ghost(3, 0)]);
    player.play(1, false);
    // The first frame waits for a timer slice; poll rather than guess how long a busy machine takes.
    for (let waited = 0; frames.length === 0 && waited < 5000; waited += 20) await new Promise((r) => setTimeout(r, 20));
    player.stop();
    const first = frames[0];
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        const d = Math.hypot(first[a * STRIDE] - first[b * STRIDE], first[a * STRIDE + 1] - first[b * STRIDE + 1]);
        expect(d).toBeGreaterThan(4.5);
      }
    }
  });
});
