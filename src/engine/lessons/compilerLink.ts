import { PRESET_BLUEPRINTS } from '../blueprints/presets';
import { createScriptHost } from '../script/host';
import { registerScriptHostFactory } from '../training/scriptHost';

let linked = false;

/**
 * Plugs the SBL compiler into the training layer on the current thread.
 * RacingTrainer only finds a script compiler through registration, and the
 * workers register theirs in src/workers/shared/loadScripts.ts. Lesson checks,
 * the benchmark tests and the reference generator train outside the workers,
 * so they register the same factory here. Doing it twice is harmless because
 * both factories build identical hosts.
 */
export function linkScriptCompiler(): void {
  if (linked) return;
  linked = true;
  registerScriptHostFactory((source) => {
    const brain = /^\s*brain\s+([a-z0-9-]+)/m.exec(source)?.[1];
    const blueprints = PRESET_BLUEPRINTS.map((b) => b.id);
    if (brain) blueprints.push(brain);
    return createScriptHost(source, { blueprints });
  });
}
