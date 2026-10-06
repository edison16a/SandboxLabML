import type { EnvId } from '@/engine/env/types';
import { explainExpr, explainStmt, fromBlocks, type ScriptBlock } from '@/engine/script';

const NO_TEXT = '';

/**
 * A block in one plain sentence for the Explain toggle. The block is
 * turned back into a statement by wrapping it in a tiny workspace, so the
 * wording comes from the same explainStmt the docs use.
 */
export function explainBlock(b: ScriptBlock, env: EnvId | null): string {
  try {
    if (b.type === 'each') return NO_TEXT;
    if (b.type === 'sensor') {
      const program = fromBlocks({ version: 1, header: null, brain: null, items: [b], trailing: null });
      const item = program.items[0];
      if (item.kind !== 'sensor') return NO_TEXT;
      return `Give the brain an input called ${item.name}: ${explainExpr(item.value, env)}, from ${explainExpr(item.lo, env)} to ${explainExpr(item.hi, env)}`;
    }
    const host: ScriptBlock = { id: 'host', type: 'each', fields: { event: 'tick' }, inputs: [], children: { body: [b] }, comment: null };
    const item = fromBlocks({ version: 1, header: null, brain: null, items: [host], trailing: null }).items[0];
    if (item.kind !== 'each' || !item.body.stmts[0]) return NO_TEXT;
    return explainStmt(item.body.stmts[0], env);
  } catch {
    return NO_TEXT;
  }
}
