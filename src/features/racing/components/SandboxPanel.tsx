'use client';

import { useState } from 'react';
import { CarFront, ChevronDown, ChevronUp, FlaskConical, Route, X } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { fieldSize } from '../session/field';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { FieldEditor } from './sandbox/FieldEditor';
import { RaceBar } from './sandbox/RaceBar';
import { TrackGallery } from './sandbox/TrackGallery';
import { TrackTools } from './sandbox/TrackTools';

type SandboxTab = 'track' | 'cars';

const iconButton = 'text-white/70 hover:bg-white/10 hover:text-white';

/**
 * Phones start with the panel folded down to its race controls, so the cars
 * are not hidden behind it. Unfolded there, it takes the whole viewport like
 * a sheet: pick a track or a field, then fold it to watch.
 */
const startsOpen = () => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches;

/**
 * The Racing Sandbox: pick or draw a track, choose which trained champions
 * line up and how many of each, then race them. It sits in the bottom right
 * corner of the viewport, clear of the followed car, and becomes a sheet
 * along the bottom on a phone. Training is paused the whole time.
 */
export function SandboxPanel() {
  const mode = useRacingLab((s) => s.mode);
  const spec = useRacingLab((s) => s.sandboxTrack);
  const editing = useRacingLab((s) => s.editingTrack);
  const cars = useRacingLab((s) => fieldSize(s.sandboxField));
  const [tab, setTab] = useState<SandboxTab>('track');
  const [open, setOpen] = useState(startsOpen);
  if (mode !== 'sandbox' || !spec) return null;

  return (
    <section
      aria-label="Sandbox"
      className="absolute right-3 bottom-3 flex max-h-[calc(100%-4.5rem)] w-[316px] flex-col overflow-hidden rounded-lg border border-white/10 bg-black/65 text-white shadow-lg shadow-black/30 backdrop-blur-md max-sm:right-2 max-sm:bottom-2 max-sm:left-2 max-sm:max-h-[calc(100%-1rem)] max-sm:w-auto"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 pr-1.5 pl-3">
        <FlaskConical className="size-3.5 text-orange" />
        <span className="text-[13px] font-semibold">Sandbox</span>
        <span className="truncate text-[11px] text-white/50">Training is paused</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" className={iconButton} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Fold the Sandbox panel' : 'Unfold the Sandbox panel'}>
            {open ? <ChevronDown /> : <ChevronUp />}
          </Button>
          <Tooltip content="Back to training">
            <Button size="icon-sm" variant="ghost" className={iconButton} onClick={() => void racingSession().exitSandbox()} aria-label="Back to training">
              <X />
            </Button>
          </Tooltip>
        </div>
      </header>
      {open && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as SandboxTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-9 border-white/10 px-1.5">
            <TabsTrigger value="track" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <Route />
              Track
            </TabsTrigger>
            <TabsTrigger value="cars" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <CarFront />
              Cars
              <span className="tabular font-mono text-[11px] text-white/50">{cars}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="track" className="flex flex-col gap-3 overflow-y-auto p-3">
            {!editing && <TrackGallery />}
            <div className={editing ? '' : 'border-t border-white/10 pt-3'}>
              <TrackTools />
            </div>
          </TabsContent>
          <TabsContent value="cars" className="overflow-y-auto p-3">
            <FieldEditor />
          </TabsContent>
        </Tabs>
      )}
      <footer className="shrink-0 border-t border-white/10 px-3 py-2">
        <RaceBar />
      </footer>
    </section>
  );
}
