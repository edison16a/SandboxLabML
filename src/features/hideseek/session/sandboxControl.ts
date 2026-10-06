import { hideSeekBlueprints, hideSeekSettingsOf } from '@/engine/training/hideseekRunConfig';
import { hideSeekScriptSource } from '@/engine/training/hideseekSetup';
import type { HideSeekPool } from '@/workers/client/hideSeekPool';
import type { SandboxScene } from '@/workers/replay/sandboxPlayer';
import { toast } from '@/ui/toast/toastStore';
import { useHideSeekLab } from '../state/hideSeekStore';
import type { AgentSlot } from '../state/types';

/**
 * The Sandbox side of the session: one match between champions the user
 * picks by generation, played in the replay worker. Edits and lesions go
 * straight to that worker; training is never touched.
 */
export class SandboxControl {
  constructor(private readonly pool: HideSeekPool) {}

  private get store() {
    return useHideSeekLab.getState();
  }

  /** Switches the viewport to the Sandbox, starting from the newest champions. */
  async enter(): Promise<void> {
    const s = this.store;
    if (!s.run || !s.records.length) {
      toast.info('Nothing to play yet', 'The Sandbox uses trained champions. Train at least one generation first.');
      return;
    }
    const last = s.records[s.records.length - 1].generation;
    s.setSandbox({ hiderGeneration: last, seekerGeneration: last, playing: true, lesions: [] });
    s.set({ mode: 'sandbox', focus: 0, source: 'replay', replaying: false });
    await this.reload();
  }

  async exit(): Promise<void> {
    await this.pool.replay.stopSandbox();
    this.store.set({ mode: 'train', focus: null, source: 'live' });
  }

  /** Rebuilds the match from the current picks. Lesions are re-applied by the worker. */
  async reload(): Promise<void> {
    const scene = this.scene();
    if (!scene) return;
    try {
      await this.pool.replay.sandboxClearLesions();
      await this.pool.replay.loadSandbox(scene);
      for (const l of this.store.sandbox.lesions) await this.pool.replay.sandboxLesion(l.agent, l.index, l.value);
      await this.pool.replay.setSandboxPaused(!this.store.sandbox.playing);
    } catch (err) {
      toast.error('Could not start the Sandbox', err instanceof Error ? err.message : String(err));
    }
  }

  async setPlaying(playing: boolean): Promise<void> {
    this.store.setSandbox({ playing });
    await this.pool.replay.setSandboxPaused(!playing);
  }

  async restart(): Promise<void> {
    await this.pool.replay.restartSandbox();
    await this.pool.replay.setSandboxPaused(!this.store.sandbox.playing);
  }

  moveBox(index: number, x: number, z: number): void {
    void this.pool.replay.sandboxMoveBox(index, x, z);
  }

  setBoxLocked(index: number, locked: boolean): void {
    void this.pool.replay.sandboxSetBoxLocked(index, locked);
  }

  /** Forces an input to `value` (0 means off), or frees it with null. */
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
    const settings = hideSeekSettingsOf(run);
    const bp = hideSeekBlueprints(run);
    return {
      hider: hider.hiderChampion,
      seeker: seeker.seekerChampion,
      hiderInputs: bp.hider.inputs,
      seekerInputs: bp.seeker.inputs,
      layout: sandbox.layout,
      seed: sandbox.seed,
      reward: settings.reward,
      physics: settings.physics,
      scriptSource: hideSeekScriptSource(run, Math.max(hider.generation, seeker.generation)),
    };
  }
}
