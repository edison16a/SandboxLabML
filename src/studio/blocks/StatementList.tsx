'use client';

import type { ScriptBlock } from '@/engine/script';
import { DropGap } from './DropGap';
import type { PaletteScope } from './model/palette';
import { childPath, type ListAddress } from './model/paths';
import { StatementBlock } from './StatementBlock';

interface Props {
  addr: ListAddress;
  /** The blocks to show with their real index in the list. The top level shows only some of its items. */
  entries: ReadonlyArray<{ block: ScriptBlock; index: number }>;
  scope: PaletteScope;
  /** Where a block dropped after the last entry goes. Defaults to right after it. */
  endIndex?: number;
}

/** A vertical stack of statements with a drop gap before each one and after the last. */
export function StatementList({ addr, entries, scope, endIndex }: Props) {
  const last = entries[entries.length - 1];
  const end = endIndex ?? (last ? last.index + 1 : 0);
  if (entries.length === 0) return <DropGap addr={addr} index={end} empty />;
  return (
    <div className="flex flex-col">
      {entries.map(({ block, index }) => (
        <div key={block.id}>
          <DropGap addr={addr} index={index} />
          <StatementBlock block={block} path={childPath(addr, index)} scope={scope} />
        </div>
      ))}
      <DropGap addr={addr} index={end} />
    </div>
  );
}

/** Every block of a plain statement list, with its index. */
export function allEntries(list: readonly ScriptBlock[] | undefined) {
  return (list ?? []).map((block, index) => ({ block, index }));
}
