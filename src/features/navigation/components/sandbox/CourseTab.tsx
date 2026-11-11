'use client';

import { Copy, Dices, Pencil, Plus, X } from 'lucide-react';
import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { NAMED_COURSES } from '@/engine/navigation/course/presets';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { navigationSession } from '../../session/NavigationSession';
import { sandboxCourseSpec } from '../../session/sandboxScene';
import { useNavigationLab } from '../../state/labStore';
import type { SandboxCourse } from '../../state/sandboxState';
import { CourseThumb } from '../CourseThumb';
import { glassButton, pickable, sectionLabel } from './glass';

interface Props {
  /** Opens the editor on a course: a copy of a built in one, or a saved one to change. */
  onEdit: (spec: CourseSpec, saved: boolean) => void;
  onNew: () => void;
}

const same = (a: SandboxCourse, b: SandboxCourse) => a.kind === b.kind && (a.kind === 'level' ? b.kind === 'level' && a.level === b.level : 'id' in b && a.id === b.id);

/** A course tile: its thumbnail and name, lit when it is the one in play. */
function Tile({ spec, on, onPick, onRemove }: { spec: CourseSpec; on: boolean; onPick: () => void; onRemove?: () => void }) {
  return (
    <div className="group relative">
      <button type="button" onClick={onPick} aria-pressed={on} title={spec.name} className={cn('flex w-full flex-col gap-1 rounded-md border p-1.5 text-left text-[11px] transition-colors', pickable(on))}>
        <CourseThumb spec={spec} width={124} className="w-full rounded-sm" />
        <span className="truncate px-0.5">{spec.name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${spec.name}`}
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded bg-black/55 text-white/70 hover:text-white focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Where the Sandbox runs: the course in play drawn large, a fresh course
 * of any level (with a new layout on demand), the named courses, and the
 * courses the user drew, plus a tile to draw a new one.
 */
export function CourseTab({ onEdit, onNew }: Props) {
  const pick = useNavigationLab((s) => s.sandbox.course);
  const saved = useNavigationLab((s) => s.sandbox.saved);
  const control = () => navigationSession().sandbox;
  const spec = sandboxCourseSpec(pick, saved);
  const own = pick.kind === 'saved';
  const choose = (course: SandboxCourse) => !same(course, pick) && control()?.configure({ course });
  const levelOf = pick.kind === 'level' ? pick.level : -1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
        <CourseThumb spec={spec} width={280} className="w-full rounded-sm" />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{pick.kind === 'level' ? NAV_LEVELS[pick.level].name : spec.name}</div>
            <div className="text-[11px] text-white/55">
              Level {spec.level}, {spec.length} m
            </div>
          </div>
          {pick.kind === 'level' && (
            <Tooltip content="A new layout of this level">
              <Button size="icon-sm" variant="secondary" className={glassButton} onClick={() => control()?.newLayout()} aria-label="New layout">
                <Dices />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={own ? 'Edit this course' : 'Edit a copy in the course editor'}>
            <Button size="sm" variant="secondary" className={glassButton} onClick={() => onEdit(spec, own)}>
              {own ? <Pencil /> : <Copy />}
              {own ? 'Edit' : 'Edit a copy'}
            </Button>
          </Tooltip>
        </div>
      </div>

      <section className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Levels</span>
        <div role="radiogroup" aria-label="Level" className="grid grid-cols-7 gap-1">
          {NAV_LEVELS.map((l) => (
            <Tooltip key={l.level} content={l.name}>
              <button
                type="button"
                role="radio"
                aria-checked={levelOf === l.level}
                aria-label={`Level ${l.level}, ${l.name}`}
                onClick={() => choose({ kind: 'level', level: l.level, seed: pick.kind === 'level' ? pick.seed : 7 })}
                className={cn('tabular h-8 rounded-md border font-mono text-[12px] transition-colors', pickable(levelOf === l.level))}
              >
                {l.level}
              </button>
            </Tooltip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Named courses</span>
        <div className="grid grid-cols-2 gap-1.5">
          {NAMED_COURSES.map((c) => (
            <Tile key={c.id} spec={c} on={pick.kind === 'named' && pick.id === c.id} onPick={() => choose({ kind: 'named', id: c.id })} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Your courses</span>
        <div className="grid grid-cols-2 gap-1.5">
          {saved.map((c) => (
            <Tile key={c.id} spec={c} on={own && pick.id === c.id} onPick={() => choose({ kind: 'saved', id: c.id })} onRemove={() => void control()?.deleteCourse(c.id)} />
          ))}
          <button type="button" onClick={onNew} className="flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/15 text-[11px] text-white/60 transition-colors hover:border-white/30 hover:text-white">
            <Plus className="size-4" />
            New course
          </button>
        </div>
      </section>
    </div>
  );
}
