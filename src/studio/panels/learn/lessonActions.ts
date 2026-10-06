import type { Lesson, LessonStep } from '@/engine/lessons/types';
import { createScript } from '@/storage/scripts';
import { toast } from '@/ui/toast/toastStore';
import { ask } from '../../state/confirm';
import { guardUnsaved, openScript, saveCurrent } from '../../state/scriptActions';
import { isDirty, useStudio } from '../../state/studioStore';

/** Each lesson works in a script of its own, so a starter never lands on top of the learner's other work. */
export function lessonScriptName(lesson: Lesson): string {
  return `Lesson: ${lesson.title}`;
}

/**
 * Puts a step's starter in the editor. In the lesson's own script it
 * replaces the text as one undoable edit, asking first when there are
 * unsaved changes. Anywhere else it opens a new script for the lesson.
 */
export async function loadStarter(lesson: Lesson, step: LessonStep): Promise<void> {
  const s = useStudio.getState();
  if (s.script && !s.script.readonly && s.script.name === lessonScriptName(lesson)) {
    if (s.history.present === step.starter) return;
    if (isDirty(s)) {
      const answer = await ask({
        title: 'Replace your text?',
        body: 'Loading the starter replaces what is in the editor. Undo brings it back, or save it first.',
        confirmLabel: 'Load starter',
        alternateLabel: 'Save first',
      });
      if (answer === 'cancel') return;
      if (answer === 'alternate' && !(await saveCurrent())) return;
    }
    useStudio.getState().edit(step.starter);
    return;
  }
  if (!(await guardUnsaved('load the lesson starter'))) return;
  try {
    const entry = await createScript({ name: lessonScriptName(lesson), source: step.starter, env: lesson.course });
    useStudio.setState((st) => ({ listVersion: st.listVersion + 1 }));
    await openScript(entry.id, { force: true });
  } catch (err) {
    toast.error('Could not load the starter', err instanceof Error ? err.message : String(err));
  }
}

/** Replaces the text with a step's solution as one undo step. */
export function applySolution(solution: string): void {
  const s = useStudio.getState();
  if (!s.script || s.script.readonly) {
    toast.info('Load the starter first', 'The solution goes into the lesson script, not a read only preset.');
    return;
  }
  s.edit(solution);
  toast.success('Solution applied', 'Undo brings your own version back.');
}
