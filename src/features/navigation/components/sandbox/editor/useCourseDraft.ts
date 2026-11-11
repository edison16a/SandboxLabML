'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCourse, isSolvable } from '@/engine/navigation/course/build';
import type { EditResult } from '@/engine/navigation/course/edit';
import type { CourseSpec } from '@/engine/navigation/course/types';

/** Undo steps kept. Courses are small, so this costs next to nothing. */
const UNDO_LIMIT = 100;
/** How long a refused edit's reason stays in the hint line, ms. */
const NOTICE_MS = 2600;

/**
 * The course being edited, with undo. Every edit replaces the whole spec
 * (the rules in course/edit return new specs), so undo is a stack of
 * earlier specs. A refused edit leaves the course alone and shows its
 * reason for a moment. `solvable` says whether a runner can still get
 * from the start to the finish, which Save needs.
 */
export function useCourseDraft(initial: CourseSpec) {
  const [state, setState] = useState({ spec: initial, past: [] as CourseSpec[] });
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const apply = useCallback((spec: CourseSpec) => {
    setState((s) => (spec === s.spec ? s : { spec, past: [...s.past.slice(1 - UNDO_LIMIT), s.spec] }));
    setNotice(null);
  }, []);

  /** Applies an edit, or shows why it was refused. */
  const edit = useCallback((result: EditResult) => (result.spec ? apply(result.spec) : flash(result.error)), [apply, flash]);

  /** Steps back one edit. The name stays as typed: renaming is not an undo step, so undo must not revert it either. */
  const undo = useCallback(() => setState((s) => (s.past.length ? { spec: { ...s.past[s.past.length - 1], name: s.spec.name }, past: s.past.slice(0, -1) } : s)), []);

  /** Renaming is not an undo step: it would make undo walk back one letter at a time. */
  const rename = useCallback((name: string) => setState((s) => ({ ...s, spec: { ...s.spec, name } })), []);

  // Building the distance field takes a few milliseconds, so it runs once per change, never per frame.
  const solvable = useMemo(() => isSolvable(buildCourse(state.spec)), [state.spec]);

  return { spec: state.spec, canUndo: state.past.length > 0, apply, edit, undo, rename, flash, notice, solvable };
}

export type CourseDraft = ReturnType<typeof useCourseDraft>;
