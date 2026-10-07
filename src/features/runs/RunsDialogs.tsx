'use client';

import { useSavedTracks } from '@/features/racing/state/savedTracks';
import type { RunRow } from '@/storage/db';
import { deleteAllData } from '@/storage/runs';
import { toast } from '@/ui/toast/toastStore';
import {
  BranchDialog,
  ConfirmDialog,
  DeleteAllDialog,
  RenameDialog,
  RewindDialog,
} from './RunDialogs';
import type { useRunActions } from './useRunActions';

export type OpenDialog =
  | { kind: 'rename' | 'branch' | 'rewind' | 'reset'; run: RunRow }
  | { kind: 'deleteAll' }
  | null;

interface Props {
  open: OpenDialog;
  setOpen: (o: OpenDialog) => void;
  actions: ReturnType<typeof useRunActions>;
  reload: () => Promise<void>;
}

/** Whichever run dialog is open on the Runs page. */
export function RunsDialogs({ open, setOpen, actions, reload }: Props) {
  return (
    <>
      {open?.kind === 'rename' && (
        <RenameDialog
          run={open.run}
          onClose={() => setOpen(null)}
          onSave={(n) => void actions.rename(open.run, n).then(() => setOpen(null))}
        />
      )}
      {open?.kind === 'branch' && (
        <BranchDialog
          run={open.run}
          onClose={() => setOpen(null)}
          onBranch={(g) => void actions.branch(open.run, g).then(() => setOpen(null))}
        />
      )}
      {open?.kind === 'rewind' && (
        <RewindDialog
          run={open.run}
          onClose={() => setOpen(null)}
          onRewind={(g) => void actions.rewind(open.run, g).then(() => setOpen(null))}
        />
      )}
      {open?.kind === 'reset' && (
        <ConfirmDialog
          title="Start over?"
          body="Same blueprint, script and seed. The current run moves to Trash for 7 days."
          action="Start over"
          onClose={() => setOpen(null)}
          onConfirm={() => void actions.reset(open.run).then(() => setOpen(null))}
        />
      )}
      {open?.kind === 'deleteAll' && (
        <DeleteAllDialog
          onClose={() => setOpen(null)}
          onConfirm={() =>
            void deleteAllData().then(() => {
              // The Racing Sandbox keeps its saved track list in memory; drop it so it reads the empty table.
              useSavedTracks.getState().reset();
              setOpen(null);
              toast.success('All data deleted');
              void reload();
            })
          }
        />
      )}
    </>
  );
}
