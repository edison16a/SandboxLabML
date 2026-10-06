/**
 * The block view's data model: a plain JSON tree the React editor renders
 * and edits. Converting a program to blocks and back loses nothing, comments
 * and blank lines included, so people can switch views freely.
 */

export type StatementBlockType = 'script' | 'brain' | 'sensor' | 'let' | 'each' | 'reward' | 'stop' | 'if' | 'repeat' | 'forEach' | 'call' | 'expression';
export type ValueBlockType = 'number' | 'text' | 'boolean' | 'name' | 'unary' | 'binary' | 'callValue' | 'settings';
export type BlockType = StatementBlockType | ValueBlockType;

export type FieldValue = string | number | boolean;

/** A slot for a nested value block. `block` is null when the slot is empty, such as a reward without `when`. */
export interface BlockInput {
  /** Argument or slot name. An empty name is a positional argument such as the x in `abs(x)`. */
  name: string;
  block: ScriptBlock | null;
}

/** Layout details that only exist to make the round trip exact. Keys are left out when unused. */
export interface BlockMeta {
  /** Comment at the end of the line (after the closing `}` for blocks with a body). */
  trailing?: string;
  /** A blank line comes before this block. */
  blankBefore?: true;
  /** Comment on the line of the opening `{`. */
  open?: string;
  /** Comment lines after the last child, before the closing `}`. */
  dangling?: string;
  /** Same as open and dangling, for the `else { }` part of an if. */
  elseOpen?: string;
  elseDangling?: string;
}

export interface ScriptBlock {
  /** Stable across round trips: derived from the parent, the slot and the block's own content. */
  id: string;
  type: BlockType;
  fields: Record<string, FieldValue>;
  inputs: BlockInput[];
  /** Statement lists, such as `body`, or `then` and `else` for an if. */
  children: Record<string, ScriptBlock[]>;
  /** Comment lines above the block, joined with newlines, or null. */
  comment: string | null;
  meta?: BlockMeta;
}

export interface BlockWorkspace {
  version: 1;
  /** The `script` line. */
  header: ScriptBlock | null;
  brain: ScriptBlock | null;
  /** Sensors, top-level lets and the each blocks, in order. */
  items: ScriptBlock[];
  /** Comment lines after everything else. */
  trailing: string | null;
}
