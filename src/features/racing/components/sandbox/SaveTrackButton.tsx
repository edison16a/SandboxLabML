'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import type { TrackSpec } from '@/engine/racing/track/types';
import { SAVED_TRACK_PREFIX } from '@/storage/tracks';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Popover } from '@/ui/primitives/Popover';
import { toast } from '@/ui/toast/toastStore';
import { nextTrackName } from '../../session/trackChoice';
import { useRacingLab } from '../../state/labStore';
import { useSavedTracks } from '../../state/savedTracks';
import { overlayButton } from './overlay';

/**
 * Saves the current track under a name. A saved track opens with its own
 * name filled in, so saving after a tweak updates it in place; anything else
 * gets the next free "My track" name.
 */
export function SaveTrackButton({ spec, picked }: { spec: TrackSpec; picked: TrackSpec | null }) {
  const saved = useSavedTracks((s) => s.tracks);
  const save = useSavedTracks((s) => s.save);
  const set = useRacingLab((s) => s.set);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    if (next) setName(picked?.id.startsWith(SAVED_TRACK_PREFIX) ? picked.name : nextTrackName(saved.map((t) => t.name)));
    setOpen(next);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const track = await save(name, spec);
      set({ sandboxTrack: track, sandboxPicked: track });
      toast.success(`Saved ${track.name}`);
      setOpen(false);
    } catch (e) {
      toast.error('Could not save the track', e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      side="top"
      align="start"
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button size="sm" variant="secondary" className={overlayButton}>
          <Save />
          Save
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Track name" hint="A name in use replaces that track.">
          <TextInput autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={busy || !name.trim()}>
            Save track
          </Button>
        </div>
      </form>
    </Popover>
  );
}
