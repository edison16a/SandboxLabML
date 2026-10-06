import { PRESET_BLUEPRINTS } from '@/engine/blueprints/presets';
import { createScriptHost } from '@/engine/script/host';
import { registerScriptHostFactory } from '@/engine/training/scriptHost';

/**
 * Plugs the SBL compiler into the training layer for this thread. The run's
 * blueprint was validated when the run was created, so here any brain the
 * script names is accepted, including the user's own blueprints.
 */
registerScriptHostFactory((source) => {
  const brain = /^\s*brain\s+([a-z0-9-]+)/m.exec(source)?.[1];
  const blueprints = PRESET_BLUEPRINTS.map((b) => b.id);
  if (brain) blueprints.push(brain);
  return createScriptHost(source, { blueprints });
});
