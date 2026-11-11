'use client';

import { useState } from 'react';
import { CarFront, ChevronDown, ChevronUp, FlaskConical, Route, X } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { drivingSession } from '../../session/DrivingSession';
import { useDrivingLab } from '../../state/labStore';
import { SandboxBar } from './SandboxBar';
import { SuvsTab } from './SuvsTab';
import { TripTab } from './TripTab';

type SandboxTab = 'trip' | 'suvs';

const iconButton = 'text-white/70 hover:bg-white/10 hover:text-white';

/**
 * Phones start with the panel folded down to its play bar, so the SUVs are
 * not hidden behind it. Unfolded there, it takes the viewport like a sheet.
 */
const startsOpen = () => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches;

/**
 * The Driving Sandbox: pick a city, a level and a route (or click a
 * destination on the map), line up trained champions or the shipped
 * trained model, then watch them drive. It sits in the bottom right corner
 * of the viewport and becomes a sheet along the bottom on a phone.
 * Training is paused the whole time.
 */
export function SandboxPanel() {
  const mode = useDrivingLab((s) => s.mode);
  const ready = useDrivingLab((s) => s.sandbox !== null);
  const suvs = useDrivingLab((s) => (s.sandbox?.model ? s.sandbox.modelCopies : (s.sandbox?.field.reduce((n, e) => n + e.copies, 0) ?? 0)));
  const [tab, setTab] = useState<SandboxTab>(() => (useDrivingLab.getState().sandbox?.model ? 'suvs' : 'trip'));
  const [open, setOpen] = useState(startsOpen);
  if (mode !== 'sandbox' || !ready) return null;

  return (
    <section
      aria-label="Sandbox"
      data-tour="sandbox-panel"
      className="absolute right-3 bottom-3 flex max-h-[calc(100%-4.5rem)] w-[316px] flex-col overflow-hidden rounded-lg border border-white/10 bg-black/65 text-white shadow-lg shadow-black/30 backdrop-blur-md max-sm:right-2 max-sm:bottom-2 max-sm:left-2 max-sm:max-h-[calc(100%-1rem)] max-sm:w-auto"
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 pr-1.5 pl-3">
        <FlaskConical className="size-3.5 text-orange" />
        <span className="text-[13px] font-semibold">Sandbox</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" className={iconButton} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Fold the Sandbox panel' : 'Unfold the Sandbox panel'}>
            {open ? <ChevronDown /> : <ChevronUp />}
          </Button>
          <Tooltip content="Back to training">
            <Button size="icon-sm" variant="ghost" className={iconButton} onClick={() => void drivingSession().exitSandbox()} aria-label="Back to training">
              <X />
            </Button>
          </Tooltip>
        </div>
      </header>
      {open && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as SandboxTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-9 border-white/10 px-1.5">
            <TabsTrigger value="trip" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <Route />
              Trip
            </TabsTrigger>
            <TabsTrigger value="suvs" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <CarFront />
              SUVs
              <span className="tabular font-mono text-[11px] text-white/50">{suvs}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="trip" className="overflow-y-auto p-3">
            <TripTab />
          </TabsContent>
          <TabsContent value="suvs" className="overflow-y-auto p-3">
            <SuvsTab />
          </TabsContent>
        </Tabs>
      )}
      <footer className="shrink-0 border-t border-white/10 px-3 py-2">
        <SandboxBar />
      </footer>
    </section>
  );
}
