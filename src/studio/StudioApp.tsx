'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResizeHandle } from '@/ui/split/ResizeHandle';
import { EditorPane } from './editor/EditorPane';
import { StudioPanels } from './panels/StudioPanels';
import { ConfirmDialog } from './shell/ConfirmDialog';
import { useStudioShortcuts } from './shell/useStudioShortcuts';
import { ScriptSidebar } from './sidebar/ScriptSidebar';
import { openInitial } from './state/scriptActions';
import { useStudio } from './state/studioStore';

/**
 * The Studio: scripts on the left, the editor in the middle, panels on
 * the right. On narrow screens the three stack and the page scrolls.
 * `?script=<id>` opens a script and `?lesson=<id>` opens a lesson.
 */
export function StudioApp() {
  const params = useSearchParams();
  const scriptParam = params.get('script');
  const lessonParam = params.get('lesson');
  useStudioShortcuts();

  useEffect(() => {
    void openInitial(scriptParam);
    // Only the first load follows the URL. Later script switches write the URL themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lessonParam) useStudio.setState({ panel: 'learn', lessonId: lessonParam });
  }, [lessonParam]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <ScriptSidebar className="max-h-[45vh] shrink-0 border-b border-border lg:max-h-none lg:w-[var(--scripts-w,256px)] lg:min-w-[224px] lg:shrink lg:border-r lg:border-b-0" />
      <ResizeHandle id="studio.scripts" cssVar="--scripts-w" pane="before" defaultSize={256} min={224} max={420} label="Resize the script list" />
      <EditorPane className="h-[75vh] shrink-0 lg:h-auto lg:min-w-[360px] lg:flex-1 lg:shrink" />
      <ResizeHandle id="studio.panels" cssVar="--panels-w" pane="after" defaultSize={440} min={430} max={820} label="Resize the panels" />
      <StudioPanels className="h-[80vh] shrink-0 border-t border-border lg:h-auto lg:w-[var(--panels-w,440px)] lg:min-w-[430px] lg:shrink lg:border-t-0 lg:border-l" />
      <ConfirmDialog />
    </div>
  );
}
