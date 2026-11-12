import { SAVE_BACKLOG, type RunSaver } from './runSaver';

/** The parts of a lab session the page guard needs. */
export interface GuardedSession {
  readonly saves: RunSaver;
  /** True while training runs. */
  training(): boolean;
  saveNow(): Promise<void>;
}

/**
 * Protects a lab's training from the tab going away. The browser asks
 * before closing while many generations are still unsaved, and a hidden
 * tab saves a checkpoint, since a tab that is hidden is often closed next.
 * Sessions live for the whole browser session, so this stays on while the
 * user looks at other pages. Call once per session, in the browser.
 */
export function guardPage(session: GuardedSession): void {
  window.addEventListener('beforeunload', (e) => {
    if (session.saves.backlog >= SAVE_BACKLOG) e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && session.training()) void session.saveNow();
  });
}
