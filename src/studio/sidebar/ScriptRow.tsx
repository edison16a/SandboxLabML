'use client';

import { Copy, FileCode2, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ScriptEntry } from '@/storage/scripts';
import { cn } from '@/ui/cn';
import { Menu, type MenuItem } from '@/ui/primitives/Menu';

const ENV_LABELS = { racing: 'Racing', hideseek: 'Hide and Seek' } as const;

function when(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
}

interface Props {
  entry: ScriptEntry;
  active: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

/** One script in the sidebar, with its actions in a menu. */
export function ScriptRow({ entry, active, onOpen, onDuplicate, onRename, onDelete }: Props) {
  const items: MenuItem[] = [{ label: 'Duplicate', icon: <Copy />, onSelect: onDuplicate }];
  if (onRename) items.push({ label: 'Rename', icon: <Pencil />, onSelect: onRename });
  if (onDelete) items.push({ label: 'Delete', icon: <Trash2 />, onSelect: onDelete, danger: true, separatorBefore: true });
  const sub = entry.readonly ? ENV_LABELS[entry.env] : `${ENV_LABELS[entry.env]}, ${when(entry.updatedAt)}`;
  return (
    <li className={cn('group flex items-center rounded-md', active ? 'bg-surface-3' : 'hover:bg-surface-2')}>
      <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left" title={entry.description || entry.name}>
        {entry.readonly ? <Lock className="size-3.5 shrink-0 text-subtle" /> : <FileCode2 className={cn('size-3.5 shrink-0', active ? 'text-accent' : 'text-subtle')} />}
        <span className="flex min-w-0 flex-col">
          <span className={cn('truncate text-[13px]', active ? 'text-fg' : 'text-fg/90')}>{entry.name}</span>
          <span className="truncate text-[11px] text-subtle">{sub}</span>
        </span>
      </button>
      <Menu
        items={items}
        trigger={
          <button type="button" aria-label={`Actions for ${entry.name}`} className="mr-1 rounded p-1 text-subtle opacity-60 group-hover:opacity-100 hover:bg-surface-3 hover:text-fg focus-visible:opacity-100">
            <MoreHorizontal className="size-4" />
          </button>
        }
      />
    </li>
  );
}
