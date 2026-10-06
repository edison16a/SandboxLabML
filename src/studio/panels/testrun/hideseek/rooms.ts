import { HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { DEFAULT_TEST_LAYOUT } from '@/engine/lessons/hideseek/rules';
import type { Program } from '@/engine/script/ast';
import { walkBlockExprs } from '@/engine/script/walk';

const isLayout = (id: string): id is HideSeekLayoutId => (HIDESEEK_LAYOUT_IDS as readonly string[]).includes(id);

/**
 * Rooms the script's generation blocks name with useLayout, in the order
 * they are written. Read from the syntax tree, so a room named only in a
 * later generation (inside an if) still counts, and nothing has to run.
 */
export function scriptRooms(program: Program): HideSeekLayoutId[] {
  const out: HideSeekLayoutId[] = [];
  for (const item of program.items) {
    if (item.kind !== 'each' || item.event !== 'generation') continue;
    walkBlockExprs(item.body, (e) => {
      if (e.kind !== 'call' || e.callee.kind !== 'name' || e.callee.path.join('.') !== 'useLayout') return;
      const arg = e.args[0]?.value;
      if (arg?.kind === 'string' && isLayout(arg.value) && !out.includes(arg.value)) out.push(arg.value);
    });
  }
  return out;
}

/** The room a test match starts in: the first one the script names, or the room a new run starts in. */
export function defaultRoom(named: readonly HideSeekLayoutId[]): HideSeekLayoutId {
  return named[0] ?? DEFAULT_TEST_LAYOUT;
}
