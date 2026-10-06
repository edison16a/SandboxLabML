'use client';

import { createContext, useContext } from 'react';
import type { EnvId } from '@/engine/env/types';
import type { BlockWorkspace } from '@/engine/script';
import type { BlockPath } from './model/paths';

export type BlockEdit = BlockWorkspace | { ws: BlockWorkspace; select: BlockPath | null };

/** What every block component needs: the tree, how to change it, and the current selection. */
export interface BlocksApi {
  ws: BlockWorkspace;
  env: EnvId | null;
  /** True for presets and while the text has a syntax error. */
  readOnly: boolean;
  explain: boolean;
  /** Names the script declares (lets, sensors, loop items), offered by the sensor picker. */
  locals: string[];
  /** pathKey of the selected statement. */
  selected: string | null;
  select: (path: BlockPath | null) => void;
  /**
   * Turns the edited tree into text and commits it as one undo step. An
   * edit may also say which statement to select afterwards, such as the
   * place a dragged block landed.
   */
  apply: (edit: (ws: BlockWorkspace) => BlockEdit) => void;
}

export const BlocksContext = createContext<BlocksApi | null>(null);

export function useBlocks(): BlocksApi {
  const api = useContext(BlocksContext);
  if (!api) throw new Error('useBlocks must be used inside the blocks view.');
  return api;
}

