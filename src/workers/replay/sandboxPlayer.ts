import type { HideSeekInputConfig } from '@/engine/hideseek/inputConfig';
import type { HideSeekPhysics } from '@/engine/hideseek/physics';
import { SandboxMatch } from '@/engine/hideseek/sandbox/match';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { SandboxTeamSetup } from '@/engine/hideseek/sandbox/types';
import type { ArenaPool } from '@/engine/hideseek/world/pool';
import type { Genome } from '@/engine/neat/types';
import type { HideSeekHostCache } from '../shared/hideSeekHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { LesionNetwork } from './lesionNetwork';
import { SandboxFrameWriter } from './sandboxFrames';

/** One team in a Sandbox scene: the champion every player of the team runs, and what it senses. */
export interface SandboxSide {
  genome: Genome;
  inputs: HideSeekInputConfig;
  count: number;
}

/** Everything the Sandbox needs to set up a match. Plain data, posted from the main thread. */
export interface SandboxScene {
  room: SandboxRoom;
  hider: SandboxSide;
  seeker: SandboxSide;
  seed: number;
  physics: HideSeekPhysics;
  /** The run's script at the picked generations, for its sensors. */
  scriptSource: string | null;
}

type Team = 'hider' | 'seeker';

/**
 * The Sandbox: trained champions, as many of each as the user asked for,
 * in a room they picked or drew. Boxes can be dragged and locked mid match
 * and brain inputs lesioned for a whole team. It runs in the replay worker,
 * never in training, so nothing done here can change a training result.
 */
export class SandboxPlayer {
  private match: SandboxMatch | null = null;
  private scene: SandboxScene | null = null;
  /** Forced inputs per team (0 hider, 1 seeker), applied to every player of that team. */
  private readonly lesions: [Map<number, number>, Map<number, number>] = [new Map(), new Map()];
  private pacer: Pacer | null = null;
  private speed = 1;
  private paused = true;
  private run = 0;
  private readonly frames: SandboxFrameWriter;

  constructor(
    stream: StreamSender,
    private readonly arenas: () => Promise<ArenaPool>,
    private readonly hosts: HideSeekHostCache,
  ) {
    // The inputs overlay shows what the brain received, so a lesioned input reads as its forced value.
    this.frames = new SandboxFrameWriter(stream, (m, slot) => (m.brains[slot] as LesionNetwork).effective);
  }

  /** Builds the match from a scene and shows its first frame. Lesions carry over to the new brains. */
  async load(scene: SandboxScene): Promise<void> {
    const runId = ++this.run;
    this.stop();
    const pool = await this.arenas();
    if (runId !== this.run) return;
    const team = (t: Team): SandboxTeamSetup => ({
      inputs: scene[t].inputs,
      brain: () => {
        const brain = new LesionNetwork(scene[t].genome);
        for (const [i, v] of this.lesions[t === 'hider' ? 0 : 1]) brain.setLesion(i, v);
        return brain;
      },
      sensors: this.hosts.controllers(scene.scriptSource, scene.seed)[t] ? (seed) => this.hosts.controllers(scene.scriptSource, seed)[t]! : null,
    });
    this.match = new SandboxMatch(pool.rapier, {
      room: scene.room,
      seed: scene.seed,
      hiders: scene.hider.count,
      seekers: scene.seeker.count,
      hider: team('hider'),
      seeker: team('seeker'),
      physics: scene.physics,
    });
    this.scene = scene;
    this.frames.begin(this.match, runId);
    this.frames.send(this.match);
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
      () => this.frames.send(m),
      () => {
        this.frames.send(m);
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

  /** Forces input `index` of every player of `team` (0 hider, 1 seeker) to `value`, or frees it with null. */
  setLesion(team: number, index: number, value: number | null): void {
    const list = this.lesions[team];
    if (!list) return;
    if (value === null) list.delete(index);
    else list.set(index, value);
    this.forEachBrain(team, (b) => b.setLesion(index, value));
  }

  clearLesions(): void {
    for (const list of this.lesions) list.clear();
    this.forEachBrain(0, (b) => b.clearLesions());
    this.forEachBrain(1, (b) => b.clearLesions());
  }

  stop(): void {
    this.pacer?.stop();
    this.pacer = null;
    this.match?.dispose();
    this.match = null;
  }

  private forEachBrain(team: number, fn: (brain: LesionNetwork) => void): void {
    const m = this.match;
    if (!m) return;
    m.state.agents.forEach((a, slot) => a.index === team && fn(m.brains[slot] as LesionNetwork));
  }

  /** Edits made while paused would not show until the next tick, so send the frame now. */
  private refresh(): void {
    if (this.match) this.frames.send(this.match);
  }
}
