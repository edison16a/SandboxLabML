import type { HideSeekInputConfig } from '@/engine/hideseek/inputConfig';
import { getLayout } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { HideSeekMatch } from '@/engine/hideseek/match/match';
import type { HideSeekPhysics } from '@/engine/hideseek/physics';
import { builtinHideSeekController, type HideSeekRewardId } from '@/engine/hideseek/rewards';
import type { ArenaPool } from '@/engine/hideseek/world/pool';
import type { Genome } from '@/engine/neat/types';
import { ArenaFrameWriter } from '../shared/arenaFrames';
import type { HideSeekHostCache } from '../shared/hideSeekHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { LesionNetwork } from './lesionNetwork';

/** One Sandbox match: a champion of each team, picked by generation, in one room. */
export interface SandboxScene {
  hider: Genome;
  seeker: Genome;
  hiderInputs: HideSeekInputConfig;
  seekerInputs: HideSeekInputConfig;
  layout: HideSeekLayoutId;
  seed: number;
  reward: HideSeekRewardId;
  physics: HideSeekPhysics;
  scriptSource: string | null;
}

/**
 * The Sandbox: one match with trained champions that the user can poke.
 * Boxes can be dragged and locked mid match, and brain inputs can be
 * lesioned. It runs in the replay worker, never in training, so nothing
 * done here can change a training result.
 */
export class SandboxPlayer {
  private match: HideSeekMatch | null = null;
  private brains: LesionNetwork[] = [];
  private scene: SandboxScene | null = null;
  private pacer: Pacer | null = null;
  private speed = 1;
  private paused = true;
  private run = 0;
  private readonly frames: ArenaFrameWriter;

  constructor(
    stream: StreamSender,
    private readonly arenas: () => Promise<ArenaPool>,
    private readonly hosts: HideSeekHostCache,
  ) {
    // The inputs overlay shows what the brain received, so a lesioned input reads as its forced value.
    this.frames = new ArenaFrameWriter(stream, (m, agent) => this.brains[agent]?.effective ?? m.observation(agent));
  }

  /** Builds the match from a scene and shows its first frame. Lesions carry over to the new brains. */
  async load(scene: SandboxScene): Promise<void> {
    const runId = ++this.run;
    const kept = this.brains.map((b) => b.lesions());
    this.stop();
    const pool = await this.arenas();
    if (runId !== this.run) return;
    const arena = pool.acquire(getLayout(scene.layout), scene.physics);
    const brains = [new LesionNetwork(scene.hider), new LesionNetwork(scene.seeker)];
    kept.forEach((list, agent) => list.forEach(([i, v]) => brains[agent].setLesion(i, v)));
    const builtin = builtinHideSeekController(scene.reward);
    const c = this.hosts.controllers(scene.scriptSource, scene.seed);
    try {
      this.match = new HideSeekMatch(
        arena,
        {
          seed: scene.seed,
          hider: { brain: brains[0], inputs: scene.hiderInputs, controller: c.hider ?? builtin },
          seeker: { brain: brains[1], inputs: scene.seekerInputs, controller: c.seeker ?? builtin },
        },
        () => pool.release(arena),
      );
    } catch (err) {
      pool.release(arena);
      throw err;
    }
    this.scene = scene;
    this.brains = brains;
    this.frames.begin([this.match], { first: 0, total: 1, epoch: runId }, 0);
    this.frames.send([this.match], 0);
    if (!this.paused) this.play();
  }

  play(): void {
    this.paused = false;
    const m = this.match;
    if (!m || m.done) return;
    if (this.pacer) return this.pacer.setPaused(false);
    const pacer = new Pacer(
      this.speed,
      30,
      (n) => {
        for (let k = 0; k < n && !m.done; k++) m.step();
        return !m.done;
      },
      () => this.frames.send([m], m.tick),
      () => {
        this.frames.send([m], m.tick);
        if (this.pacer === pacer) this.pacer = null;
      },
    );
    this.pacer = pacer;
    pacer.start();
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.paused = true;
      this.pacer?.setPaused(true);
    } else this.play();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.pacer?.setSpeed(speed);
  }

  async restart(): Promise<void> {
    if (this.scene) await this.load(this.scene);
  }

  moveBox(index: number, x: number, z: number): void {
    this.match?.moveBox(index, x, z);
    this.refresh();
  }

  setBoxLocked(index: number, locked: boolean): void {
    this.match?.setBoxLocked(index, locked);
    this.refresh();
  }

  /** Forces input `index` of agent `agent` (0 hider, 1 seeker) to `value`, or frees it with null. */
  setLesion(agent: number, index: number, value: number | null): void {
    this.brains[agent]?.setLesion(index, value);
  }

  clearLesions(): void {
    for (const b of this.brains) b.clearLesions();
  }

  stop(): void {
    this.pacer?.stop();
    this.pacer = null;
    this.match?.release();
    this.match = null;
  }

  /** Edits made while paused would not show until the next tick, so send the frame now. */
  private refresh(): void {
    if (this.match) this.frames.send([this.match], this.match.tick);
  }
}
