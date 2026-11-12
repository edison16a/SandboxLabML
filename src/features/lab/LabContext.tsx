'use client';

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { AnyEpisodeModule } from '@/engine/env/episode';
import type { EnvId } from '@/engine/env/types';
import type { RunConfig } from '@/engine/training/runConfig';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import type { SpeedMode } from '@/workers/shared/protocol';
import type { LabState, LabStoreApi } from './state/labState';

/** The parts of a lab's session the shared components call. Every EpisodeSession has them. */
export interface LabSession {
  readonly streams: { population: SnapshotStream; ghosts: SnapshotStream } | null;
  /** Starts the workers. Safe to call again; it starts them once. */
  init(): Promise<unknown>;
  newRun(config: RunConfig): Promise<void>;
  start(generations?: number): Promise<void>;
  pause(): Promise<void>;
  setSpeed(mode: SpeedMode): Promise<void>;
  openRun(runId: string): Promise<boolean>;
  /** Resends the Sandbox scene after a lesion. A lab without a Sandbox ignores it. */
  sandboxChanged(): void;
}

/**
 * What the shared lab components need from the lab they sit in: its env,
 * its store and its session. A lab provides one of these at its root, so
 * the toolbar, the side panel tabs and the hooks work in every lab.
 */
export interface LabContextValue {
  env: EnvId;
  /** The env's module, for labels, outputs, metrics and the input schema. */
  module: AnyEpisodeModule;
  /** The lab's store. Its state may hold more than LabState; shared code only touches the shared fields. */
  api: LabStoreApi;
  session: LabSession;
  /** Setting that remembers the run the lab opened last, such as "driving.lastRun". */
  lastRunKey: string;
  /** What one agent is called in this lab, such as "SUV", for labels like "Followed SUV". */
  agentNoun: string;
}

const LabContext = createContext<LabContextValue | null>(null);

export const LabProvider = LabContext.Provider;

export function useLabContext(): LabContextValue {
  const value = useContext(LabContext);
  if (!value) throw new Error('A shared lab component was rendered outside a LabProvider.');
  return value;
}

/** Reads a slice of the lab's store and re-renders when it changes. */
export function useLab<T>(selector: (s: LabState) => T): T {
  return useStore(useLabContext().api, selector);
}

/** Writes shared fields of the lab's store. */
export function useLabSet(): (patch: Partial<LabState>) => void {
  const { api } = useLabContext();
  return api.setState;
}
