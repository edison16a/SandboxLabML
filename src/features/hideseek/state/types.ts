import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';

export type Team = 'hider' | 'seeker';

/** Agent slot in a snapshot and in inspect addressing: 0 hider, 1 seeker. */
export type AgentSlot = 0 | 1;

/** Arenas the grid shows. 1 is the showcase on its own. */
export type GridSize = 1 | 4 | 9 | 25 | 50;
export const GRID_SIZES: GridSize[] = [1, 4, 9, 25, 50];

/** Render tiers. Ultra adds 4096 px shadows and full resolution effects to the showcase; see useHideSeekQuality for when it applies. */
export type HsQualityTier = 'low' | 'medium' | 'high' | 'ultra';

/** Orbit and top down look at the arenas; the POV cameras ride on an agent of the focused arena. */
export type HsCamera = 'orbit' | 'top' | 'seeker' | 'hider';
export const HS_CAMERAS: HsCamera[] = ['orbit', 'top', 'seeker', 'hider'];

export type HsPanelTab = 'progress' | 'network' | 'inputs' | 'model';

/** Training shows the live round or a replay; the Sandbox plays one match the user sets up and can edit. */
export type LabMode = 'train' | 'sandbox';

/** Which arena stream the viewport reads. */
export type FeedSource = 'live' | 'replay';

/** The round being played, from the coordinator's round event. */
export interface RoundInfo {
  generation: number;
  round: number;
  rounds: number;
  layout: HideSeekLayoutId;
  matches: number;
  live: boolean;
}

/** A forced input in the Sandbox lesion test. It applies to every player of the team. */
export interface Lesion {
  /** The team: 0 hiders, 1 seekers. */
  agent: AgentSlot;
  index: number;
  /** 0 for "off", anything else for a frozen reading. */
  value: number;
}

export interface SandboxSettings {
  hiderGeneration: number;
  seekerGeneration: number;
  /** The room in play: a preset layout id or the id of one of `rooms`. */
  roomId: string;
  hiders: number;
  seekers: number;
  /** Fixes the spawn spots. The dice button rolls a new one. */
  seed: number;
  playing: boolean;
  lesions: Lesion[];
  /** The user's own rooms, loaded from storage when the Sandbox first opens. */
  rooms: SandboxRoom[];
}
