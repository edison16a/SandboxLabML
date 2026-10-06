import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { hideSeekBlueprints, hideSeekSettingsOf } from '@/engine/training/hideseekRunConfig';
import { hideSeekScriptSource } from '@/engine/training/hideseekSetup';
import type { HideSeekPool } from '@/workers/client/hideSeekPool';
import type { SandboxScene } from '@/workers/replay/sandboxPlayer';
import { toast } from '@/ui/toast/toastStore';
import { useHideSeekLab } from '../state/hideSeekStore';
import type { AgentSlot, SandboxSettings } from '../state/types';
import { dropRoom, loadSandboxRooms, rememberSandboxSetup, roomById, storeRoom } from './sandboxRooms';

/**
 * The Sandbox side of the session: trained champions, as many of each as
 * the user picks, in a preset room or one they drew, played in the replay
 * worker. Edits and lesions go straight to that worker; training is never
 * touched.
 */
export class SandboxControl {
  constructor(private readonly pool: HideSeekPool) {}

  private get store() {
    return useHideSeekLab.getState();
  }

  /** Switches the viewport to the Sandbox, starting from the newest champions, paused on the first frame. */
  async enter(): Promise<void> {
    const s = this.store;
    if (!s.run || !s.records.length) {
      toast.info('Nothing to play yet', 'The Sandbox uses trained champions. Train at least one generation first.');
      return;
    }
    await loadSandboxRooms();
    const last = s.records[s.records.length - 1].generation;
    s.setSandbox({ hiderGeneration: last, seekerGeneration: last, playing: false, lesions: [] });
    s.set({ mode: 'sandbox', focus: 0 });
    await this.reload();
  }

  async exit(): Promise<void> {
    await this.pool.replay.stopSandbox();
    this.store.set({ mode: 'train', focus: null, source: 'live' });
  }

  /** Changes the setup and rebuilds the match from it. Lesions carry over. */
  async configure(patch: Partial<Pick<SandboxSettings, 'roomId' | 'hiders' | 'seekers' | 'seed' | 'hiderGeneration' | 'seekerGeneration'>>): Promise<void> {
    this.store.setSandbox(patch);
    if ('roomId' in patch || 'hiders' in patch || 'seekers' in patch) rememberSandboxSetup();
    await this.reload();
  }

  /** Rebuilds the match from the current setup. Lesions are kept by the worker. */
  async reload(): Promise<void> {
    const scene = this.scene();
    if (!scene) return;
    try {
      await this.pool.replay.loadSandbox(scene);
      await this.pool.replay.setSandboxPaused(!this.store.sandbox.playing);
    } catch (err) {
      toast.error('Could not start the Sandbox', err instanceof Error ? err.message : String(err));
    }
  }

  async setPlaying(playing: boolean): Promise<void> {
    this.store.setSandbox({ playing });
    await this.pool.replay.setSandboxPaused(!playing);
  }

  /** Plays the same setup again from the start. It keeps playing if it was. */
  async restart(): Promise<void> {
    await this.pool.replay.restartSandbox();
    await this.pool.replay.setSandboxPaused(!this.store.sandbox.playing);
  }

  /** Saves a room the user edited and plays it. */
  async saveRoom(room: SandboxRoom): Promise<void> {
    try {
      const saved = await storeRoom(room);
      await this.configure({ roomId: saved.id });
    } catch (err) {
      toast.error('Could not save the room', err instanceof Error ? err.message : String(err));
    }
  }

  async deleteRoom(id: string): Promise<void> {
    try {
      if (await dropRoom(id)) await this.reload();
    } catch (err) {
      toast.error('Could not delete the room', err instanceof Error ? err.message : String(err));
    }
  }

  moveBox(index: number, x: number, z: number): void {
    void this.pool.replay.sandboxMoveBox(index, x, z);
  }

  setBoxLocked(index: number, locked: boolean): void {
    void this.pool.replay.sandboxSetBoxLocked(index, locked);
  }

  /** Forces an input of every player of a team to `value` (0 means off), or frees it with null. */
  setLesion(agent: AgentSlot, index: number, value: number | null): void {
    const rest = this.store.sandbox.lesions.filter((l) => !(l.agent === agent && l.index === index));
    this.store.setSandbox({ lesions: value === null ? rest : [...rest, { agent, index, value }] });
    void this.pool.replay.sandboxLesion(agent, index, value);
  }

  clearLesions(): void {
    this.store.setSandbox({ lesions: [] });
    void this.pool.replay.sandboxClearLesions();
  }

  private scene(): SandboxScene | null {
    const { run, records, sandbox } = this.store;
    if (!run) return null;
    const hider = records.find((r) => r.generation === sandbox.hiderGeneration) ?? records[records.length - 1];
    const seeker = records.find((r) => r.generation === sandbox.seekerGeneration) ?? records[records.length - 1];
    if (!hider || !seeker) return null;
    const bp = hideSeekBlueprints(run);
    return {
      room: roomById(sandbox.roomId, sandbox.rooms),
      hider: { genome: hider.hiderChampion, inputs: bp.hider.inputs, count: sandbox.hiders },
      seeker: { genome: seeker.seekerChampion, inputs: bp.seeker.inputs, count: sandbox.seekers },
      seed: sandbox.seed,
      physics: hideSeekSettingsOf(run).physics,
      scriptSource: hideSeekScriptSource(run, Math.max(hider.generation, seeker.generation)),
    };
  }
}
