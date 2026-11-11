'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical, Map as MapIcon, Users, X } from 'lucide-react';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { emptyCourse } from '@/engine/navigation/course/sandbox';
import { newCourseId } from '@/storage/courses';
import { Button } from '@/ui/primitives/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { navigationSession } from '../../session/NavigationSession';
import { useNavigationLab } from '../../state/labStore';
import { fieldSize } from '../../state/sandboxState';
import { CourseEditorDialog } from './editor/CourseEditorDialog';
import { CourseTab } from './CourseTab';
import { RunBar } from './RunBar';
import { RunnersTab } from './RunnersTab';

type SandboxTab = 'course' | 'runners';

const iconButton = 'text-white/70 hover:bg-white/10 hover:text-white';

/** Phones start with the panel folded to its run controls, so the runners are not hidden behind it. */
const startsOpen = () => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches;

/** A copy of a course to edit, under a fresh id and a name of its own. */
function copyOf(spec: CourseSpec, taken: readonly CourseSpec[]): CourseSpec {
  const names = new Set(taken.map((c) => c.name));
  let name = `${spec.name} copy`;
  for (let k = 2; names.has(name); k++) name = `${spec.name} copy ${k}`;
  return { ...structuredClone(spec), id: newCourseId(), name };
}

/**
 * The Navigation Sandbox: pick or draw a course, choose who runs (copies
 * of this run's champions, or a model trained with a preset), then play,
 * pause and restart. It sits in the bottom right corner of the viewport
 * and becomes a sheet along the bottom on a phone. Training waits the
 * whole time.
 */
export function SandboxPanel() {
  const mode = useNavigationLab((s) => s.mode);
  const saved = useNavigationLab((s) => s.sandbox.saved);
  const runners = useNavigationLab((s) => (s.sandbox.source === 'model' ? s.sandbox.modelCopies : fieldSize(s.sandbox.field)));
  const [tab, setTab] = useState<SandboxTab>('course');
  const [open, setOpen] = useState(startsOpen);
  const [editing, setEditing] = useState<{ spec: CourseSpec; saved: boolean } | null>(null);
  if (mode !== 'sandbox') return null;
  const control = () => navigationSession().sandbox;
  const newName = () => {
    const names = new Set(saved.map((c) => c.name));
    let k = saved.length + 1;
    while (names.has(`Course ${k}`)) k++;
    return `Course ${k}`;
  };

  return (
    <section
      aria-label="Sandbox"
      data-testid="nav-sandbox"
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
            <Button size="icon-sm" variant="ghost" className={iconButton} onClick={() => void navigationSession().exitSandbox()} aria-label="Back to training">
              <X />
            </Button>
          </Tooltip>
        </div>
      </header>
      {open && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as SandboxTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-9 border-white/10 px-1.5">
            <TabsTrigger value="course" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <MapIcon />
              Course
            </TabsTrigger>
            <TabsTrigger value="runners" className="text-white/60 hover:text-white data-[state=active]:text-white">
              <Users />
              Runners
              <span className="tabular font-mono text-[11px] text-white/50">{runners}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="course" className="overflow-y-auto p-3">
            <CourseTab onEdit={(spec, own) => setEditing({ spec: own ? structuredClone(spec) : copyOf(spec, saved), saved: own })} onNew={() => setEditing({ spec: emptyCourse(newCourseId(), newName()), saved: false })} />
          </TabsContent>
          <TabsContent value="runners" className="overflow-y-auto p-3">
            <RunnersTab />
          </TabsContent>
        </Tabs>
      )}
      <footer className="shrink-0 border-t border-white/10 px-3 py-2">
        <RunBar />
      </footer>
      {editing && (
        <CourseEditorDialog
          course={editing.spec}
          saved={editing.saved}
          onClose={() => setEditing(null)}
          onSave={async (spec) => {
            // Close only once the course is stored: on a failure the draft lives only in the editor.
            if (await control()?.saveCourse(spec)) setEditing(null);
          }}
          onDelete={(id) => {
            setEditing(null);
            void control()?.deleteCourse(id);
          }}
        />
      )}
    </section>
  );
}
