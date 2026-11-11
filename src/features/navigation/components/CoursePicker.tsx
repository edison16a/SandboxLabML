'use client';

import { useMemo } from 'react';
import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { generateCourse } from '@/engine/navigation/course/generate';
import { TRAINING_COURSES } from '@/engine/navigation/course/presets';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { CourseThumb } from './CourseThumb';

export interface CourseChoice {
  /** A named course id, or null for fresh generated courses each generation. */
  course: string | null;
  startLevel: number;
  autoLevel: boolean;
}

/** A tile of the course grid: a thumbnail with its name and level under it. */
function Tile({ active, onClick, title, note, children }: { active: boolean; onClick: () => void; title: string; note: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex flex-col items-stretch gap-1.5 rounded-md border p-2 text-left transition-colors', active ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
    >
      <span className="flex h-12 items-center justify-center">{children}</span>
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium">{title}</span>
        <span className="shrink-0 text-[11px] text-subtle">{note}</span>
      </span>
    </button>
  );
}

/**
 * What a new run trains on: fresh courses from a start level, climbing the
 * curriculum on its own or staying put, or one named course every
 * generation. The fresh tile shows a sample course of the start level.
 */
export function CoursePicker({ value, onChange }: { value: CourseChoice; onChange: (v: CourseChoice) => void }) {
  const sample = useMemo(() => generateCourse(value.startLevel, 7), [value.startLevel]);
  const level = NAV_LEVELS[value.startLevel];
  return (
    <div className="flex flex-col gap-4">
      <Field label="Courses" hint={value.course ? 'Every generation runs this one course.' : 'Fresh courses every generation, so brains learn to navigate rather than memorize one room.'}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile active={value.course === null} onClick={() => onChange({ ...value, course: null })} title="Fresh courses" note={`from ${value.startLevel}`}>
            <CourseThumb spec={sample} width={104} />
          </Tile>
          {TRAINING_COURSES.map((c) => (
            <Tile key={c.id} active={value.course === c.id} onClick={() => onChange({ ...value, course: c.id })} title={c.name} note={`level ${c.level}`}>
              <CourseThumb spec={c} width={104} />
            </Tile>
          ))}
        </div>
      </Field>
      {value.course === null && (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Start level" hint={`${level.name}. ${level.description}`}>
            <Segmented
              label="Start level"
              value={String(value.startLevel)}
              onChange={(v) => onChange({ ...value, startLevel: Number(v) })}
              options={NAV_LEVELS.map((l) => ({ value: String(l.level), label: String(l.level), title: l.name }))}
            />
          </Field>
          <Field label="Curriculum" hint={value.autoLevel ? 'Moves up once the best fifth finishes almost every course.' : 'Stays on the start level.'}>
            <label className="flex h-8 items-center gap-2 text-[13px]">
              <Switch label="Climb the levels" checked={value.autoLevel} onChange={(v) => onChange({ ...value, autoLevel: v })} />
              Climb the levels
            </label>
          </Field>
        </div>
      )}
    </div>
  );
}
