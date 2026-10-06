'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import type { EnvId } from '@/engine/env/types';
import { findLesson, lessonsFor } from '@/engine/lessons/catalog';
import type { Lesson } from '@/engine/lessons/types';
import { listLessonProgress, type LessonProgress } from '@/storage/lessonProgress';
import { Segmented } from '@/ui/primitives/Segmented';
import { analyze } from '../../doc/analyze';
import { selectText, useStudio } from '../../state/studioStore';
import { LessonPlayer } from './LessonPlayer';
import { lessonFraction } from './player';

/**
 * Courses of short lessons for each environment, Racing and Hide and
 * Seek. A course with no lessons in the catalog shows a friendly note
 * instead of an empty list.
 */
export default function LearnTab() {
  const text = useStudio(selectText);
  const lessonId = useStudio((s) => s.lessonId);
  const [course, setCourse] = useState<EnvId>(() => analyze(text).env ?? 'racing');
  // Null until loaded, so a lesson opened from a link resumes from saved progress instead of step one.
  const [progress, setProgress] = useState<Map<string, LessonProgress> | null>(null);
  const reload = useCallback(() => void listLessonProgress().then(setProgress, () => setProgress(new Map())), []);
  useEffect(reload, [reload]);

  const open = lessonId ? findLesson(lessonId) : undefined;
  // Back lands on the open lesson's course, which may not be the one picked before a link opened it.
  const back = (lesson: Lesson) => {
    setCourse(lesson.course);
    useStudio.setState({ lessonId: null });
  };
  if (open && progress) return <LessonPlayer key={open.id} lesson={open} saved={progress.get(open.id)} onBack={() => back(open)} onProgress={reload} />;

  const lessons = lessonsFor(course);
  return (
    <div className="flex flex-col gap-4 p-4">
      <Segmented<EnvId>
        label="Course"
        value={course}
        onChange={setCourse}
        options={[
          { value: 'racing', label: 'Racing' },
          { value: 'hideseek', label: 'Hide and Seek' },
        ]}
      />
      {lessonId && !open && <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">The lesson in the link was not found. Pick one below.</p>}
      {lessons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <GraduationCap className="size-6 text-muted" />
          <p className="text-[13px] font-medium">Lessons are on their way</p>
          <p className="max-w-72 text-[12px] text-muted">
            Until they arrive, open a preset and switch on Explain in the blocks view to read each line in plain words.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Lessons">
          {lessons.map((l) => {
            const fraction = lessonFraction(l, progress?.get(l.id));
            return (
              <li key={l.id}>
                <button type="button" onClick={() => useStudio.setState({ lessonId: l.id })} className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-surface-2 p-3 text-left hover:border-border-strong">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {l.order}. {l.title}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-subtle">
                      <Clock className="size-3" />
                      {l.minutes} min
                    </span>
                  </span>
                  <span className="text-[12px] text-muted">{l.summary}</span>
                  <span className="h-1 overflow-hidden rounded-full bg-surface-3" aria-label={`${Math.round(fraction * 100)}% done`}>
                    <span className="block h-full rounded-full bg-success" style={{ width: `${fraction * 100}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
