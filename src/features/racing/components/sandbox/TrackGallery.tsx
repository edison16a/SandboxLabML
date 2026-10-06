'use client';

import { useEffect } from 'react';
import { Dices, PencilRuler } from 'lucide-react';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { randomTrackSpec } from '@/engine/racing/track/randomTrack';
import type { TrackSpec } from '@/engine/racing/track/types';
import { toast } from '@/ui/toast/toastStore';
import { racingSession } from '../../session/RacingSession';
import { blankLoop, sameRoad } from '../../session/trackChoice';
import { useRacingLab } from '../../state/labStore';
import { useSavedTracks } from '../../state/savedTracks';
import { sectionLabel } from './overlay';
import { TrackTile } from './TrackTile';

/**
 * Every track the Sandbox can race on: the built in ones, the run's own
 * track when it is not one of them, a random one, a blank loop to draw on,
 * and the user's saved tracks. A tile stays lit only while its track is
 * unedited, so it never claims a shape the user has since changed.
 */
export function TrackGallery() {
  const run = useRacingLab((s) => s.run);
  const spec = useRacingLab((s) => s.sandboxTrack);
  const picked = useRacingLab((s) => s.sandboxPicked);
  const set = useRacingLab((s) => s.set);
  const saved = useSavedTracks((s) => s.tracks);
  const load = useSavedTracks((s) => s.load);
  const remove = useSavedTracks((s) => s.remove);
  const restore = useSavedTracks((s) => s.restore);
  useEffect(() => void load(), [load]);
  if (!spec) return null;

  const current = picked && sameRoad(spec, picked) ? picked.id : null;
  const runTrack = run?.racing?.track;
  // The run's own track gets a tile only when no built in or saved tile already shows that road.
  const ownTile = runTrack && ![...BUILT_IN_TRACKS, ...saved].some((t) => sameRoad(t, runTrack)) ? runTrack : null;
  const tag = (t: TrackSpec) => (runTrack && sameRoad(t, runTrack) ? 'Trained' : undefined);
  // One tile lights at a time: a tile with the track's exact id, or else the Random or Draw tile that made it.
  const exact = current && [...BUILT_IN_TRACKS, ...saved, ...(ownTile ? [ownTile] : [])].some((t) => t.id === current) ? current : null;
  const made = exact ? null : current?.startsWith('random-') ? 'random' : current?.startsWith('custom-') ? 'draw' : null;
  const pick = (t: TrackSpec) => {
    set({ editingTrack: false });
    racingSession().sandbox?.setTrack(structuredClone(t));
  };
  const onRemove = async (t: TrackSpec) => {
    const row = await remove(t.id);
    if (row) toast.withAction(`Deleted ${t.name}`, { label: 'Undo', onClick: () => void restore(row) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5">
        {BUILT_IN_TRACKS.map((t) => (
          <TrackTile key={t.id} label={t.name} spec={t} tag={tag(t)} selected={exact === t.id} onSelect={() => pick(t)} />
        ))}
        {ownTile && <TrackTile label={ownTile.name} spec={ownTile} tag="Trained" selected={exact === ownTile.id} onSelect={() => pick(ownTile)} />}
        <TrackTile
          label="Random"
          icon={<Dices />}
          spec={made === 'random' ? spec : undefined}
          selected={made === 'random'}
          onSelect={() => pick(randomTrackSpec(Math.floor(Math.random() * 1e6), spec.width))}
        />
        <TrackTile
          label="Draw"
          icon={<PencilRuler />}
          selected={made === 'draw'}
          onSelect={() => {
            racingSession().sandbox?.setTrack(blankLoop(spec.width));
            set({ editingTrack: true });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Saved</span>
        {saved.length ? (
          <div className="grid grid-cols-4 gap-1.5">
            {saved.map((t) => (
              <TrackTile key={t.id} label={t.name} spec={t} tag={tag(t)} selected={exact === t.id} onSelect={() => pick(t)} onRemove={() => void onRemove(t)} />
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-white/50">Draw a track and save it, and it shows up here.</p>
        )}
      </div>
    </div>
  );
}
