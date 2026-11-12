import type { EnvId } from '@/engine/env/types';
import { scriptEnv } from '@/engine/script';
import { getSetting, setSetting } from '@/storage/settings';
import { createScript, deleteScript, duplicateScript, getScript, listPresets, renameScript, saveScript } from '@/storage/scripts';
import { toast } from '@/ui/toast/toastStore';
import { ask } from './confirm';
import { shownScript, STARTER_SCRIPT_ID } from './studioEnvs';
import { isDirty, useStudio } from './studioStore';

const LAST_SCRIPT_KEY = 'studio.lastScript';

/** What a new script starts with, so it runs before the author changes anything. */
export function starterSource(env: EnvId): string {
  return scriptEnv(env)?.starter ?? `script "My script" for ${env} v1\n`;
}

const fail =
  (title: string) =>
  (err: unknown): undefined => {
    toast.error(title, err instanceof Error ? err.message : String(err));
    return undefined;
  };

function bumpList(): void {
  useStudio.setState((s) => ({ listVersion: s.listVersion + 1 }));
}

/** Keeps ?script= in the address bar in step with the open script, without a navigation. */
function syncUrl(id: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('script', id);
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Asks before throwing away unsaved work. Returns false when the author
 * cancels. "Save first" saves and then lets the caller carry on.
 */
export async function guardUnsaved(action: string): Promise<boolean> {
  if (!isDirty(useStudio.getState())) return true;
  const answer = await ask({
    title: 'Unsaved changes',
    body: `This script has changes that are not saved yet. Save them before you ${action}?`,
    confirmLabel: 'Discard changes',
    alternateLabel: 'Save first',
    danger: true,
  });
  if (answer === 'cancel') return false;
  if (answer === 'alternate') return saveCurrent();
  return true;
}

export async function openScript(id: string, opts: { force?: boolean } = {}): Promise<boolean> {
  if (useStudio.getState().script?.id === id) return true;
  if (!opts.force && !(await guardUnsaved('switch scripts'))) return false;
  const entry = await getScript(id);
  if (!entry) {
    toast.error('Script not found', 'It may have been deleted.');
    return false;
  }
  if (!shownScript(entry)) {
    toast.info('That script is for a lab this version does not have.');
    return false;
  }
  useStudio.getState().open(entry);
  syncUrl(id);
  void setSetting(LAST_SCRIPT_KEY, id);
  return true;
}

/** Opens the script a newcomer starts on, the Driving Beginner preset, or the first preset shown if that one is missing. */
async function openStarter(): Promise<void> {
  const id = (await getScript(STARTER_SCRIPT_ID)) ? STARTER_SCRIPT_ID : listPresets().find(shownScript)?.id;
  if (id) await openScript(id, { force: true });
}

/**
 * Opens ?script=, else the last script, else the starter preset. A script
 * of a removed lab is skipped; a link to one says so.
 */
export async function openInitial(requested: string | null): Promise<void> {
  const last = await getSetting<string>(LAST_SCRIPT_KEY).catch(() => null);
  for (const id of [requested, last]) {
    const entry = id ? await getScript(id) : undefined;
    if (!entry) continue;
    if (!shownScript(entry)) {
      if (id === requested) toast.info('That script is for a lab this version does not have.');
      continue;
    }
    await openScript(entry.id, { force: true });
    return;
  }
  await openStarter();
}

export async function saveCurrent(): Promise<boolean> {
  const s = useStudio.getState();
  if (!s.script) return false;
  if (s.script.readonly) {
    toast.info('Presets are read only', 'Duplicate it to edit.');
    return false;
  }
  const text = s.history.present;
  useStudio.setState({ saving: true });
  try {
    const entry = await saveScript(s.script.id, text);
    useStudio.setState({ script: entry, saved: text });
    bumpList();
    return true;
  } catch (err) {
    fail('Could not save')(err);
    return false;
  } finally {
    useStudio.setState({ saving: false });
  }
}

export async function newScript(env: EnvId): Promise<void> {
  if (!(await guardUnsaved('start a new script'))) return;
  const entry = await createScript({ name: 'New script', source: starterSource(env), env }).catch(fail('Could not create the script'));
  if (!entry) return;
  bumpList();
  await openScript(entry.id, { force: true });
}

export async function duplicate(id: string): Promise<void> {
  if (!(await guardUnsaved('duplicate'))) return;
  const entry = await duplicateScript(id).catch(fail('Could not duplicate'));
  if (!entry) return;
  bumpList();
  await openScript(entry.id, { force: true });
  toast.success(`Created "${entry.name}"`);
}

export async function rename(id: string, name: string): Promise<void> {
  try {
    await renameScript(id, name);
  } catch (err) {
    fail('Could not rename')(err);
    return;
  }
  const s = useStudio.getState();
  if (s.script?.id === id) useStudio.setState({ script: { ...s.script, name: name.trim() } });
  bumpList();
}

export async function remove(id: string, name: string): Promise<void> {
  const answer = await ask({ title: 'Delete script', body: `Delete "${name}" and its saved versions? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
  if (answer !== 'confirm') return;
  await deleteScript(id).catch(fail('Could not delete'));
  bumpList();
  if (useStudio.getState().script?.id === id) await openStarter();
}
