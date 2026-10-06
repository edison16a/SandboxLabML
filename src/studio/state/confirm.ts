import { create } from 'zustand';

export type ConfirmAnswer = 'confirm' | 'alternate' | 'cancel';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  /** A second way forward, such as "Save first". Left out for a plain yes or no. */
  alternateLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  resolve: ((answer: ConfirmAnswer) => void) | null;
  answer: (answer: ConfirmAnswer) => void;
}

/**
 * One confirm dialog for the whole Studio, driven by a promise, so actions
 * can read like `if (await ask(...) === 'confirm')` instead of threading
 * dialog state through every component.
 */
export const useConfirm = create<ConfirmState>((set, get) => ({
  request: null,
  resolve: null,
  answer: (answer) => {
    get().resolve?.(answer);
    set({ request: null, resolve: null });
  },
}));

export function ask(request: ConfirmRequest): Promise<ConfirmAnswer> {
  useConfirm.getState().resolve?.('cancel');
  return new Promise((resolve) => useConfirm.setState({ request, resolve }));
}
