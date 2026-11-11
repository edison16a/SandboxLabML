'use client';

import { useState } from 'react';
import type { EpisodeBlueprint } from '@/engine/blueprints/types';
import { navigationSettings } from '@/engine/navigation/pipeline/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { NewRunShell } from '@/features/lab/newrun/NewRunShell';
import type { ScriptChoice } from '@/features/scripts/scriptChoice';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { DEFAULT_NAVIGATION_BLUEPRINT } from '../hooks/defaultRun';
import { CoursePicker, type CourseChoice } from './CoursePicker';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice<EpisodeBlueprint<'navigation'>>;
}

type Count = '1' | '2' | '3';

/** The shared new run dialog with Navigation's own fields: the courses, the start level and how many courses a generation runs. */
export function NewRunDialog({ open, onOpenChange, initialScript }: Props) {
  const [choice, setChoice] = useState<CourseChoice>({ course: null, startLevel: 0, autoLevel: true });
  const [courses, setCourses] = useState<Count>('2');
  return (
    <NewRunShell<EpisodeBlueprint<'navigation'>>
      open={open}
      onOpenChange={onOpenChange}
      title="New navigation run"
      defaultBlueprint={DEFAULT_NAVIGATION_BLUEPRINT}
      initialScript={initialScript}
      build={(basics) =>
        createEpisodeRunConfig({
          env: 'navigation',
          ...basics,
          settings: { ...navigationSettings({ course: choice.course, startLevel: choice.startLevel, autoLevel: choice.autoLevel, coursesPerGeneration: Number(courses) }) },
        })
      }
      besideSeed={
        <Field label="Courses per generation" hint={choice.course ? 'A named course runs once.' : 'Each brain scores its average.'}>
          <Segmented<Count> label="Courses per generation" value={courses} onChange={setCourses} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]} />
        </Field>
      }
    >
      <CoursePicker value={choice} onChange={setChoice} />
    </NewRunShell>
  );
}
