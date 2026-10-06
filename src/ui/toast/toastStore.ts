import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * Global toast queue. Worker errors, saves and undo prompts all land here, so
 * nothing in the app needs its own notification UI.
 */
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = 4500) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] });
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Shorthand for code outside React components. */
export const toast = {
  info: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: 'info' }),
  success: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: 'error' }, 8000),
  withAction: (title: string, action: Toast['action'], description?: string) =>
    useToasts.getState().push({ title, description, tone: 'info', action }, 7000),
};
