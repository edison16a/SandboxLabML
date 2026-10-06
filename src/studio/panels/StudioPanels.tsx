'use client';

import dynamic from 'next/dynamic';
import { BookOpen, CircleAlert, Gauge, GraduationCap, Play } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { analyze } from '../doc/analyze';
import { selectText, useStudio, type PanelTab } from '../state/studioStore';
import { ProblemsTab } from './problems/ProblemsTab';
import { ReferenceTab } from './reference/ReferenceTab';

function Loading() {
  return <div className="p-6 text-center text-[13px] text-muted">Loading...</div>;
}

/** The heavier tabs load on first open: Test run brings uPlot and a worker, Learn and Bench bring their engines. */
const TestRunTab = dynamic(() => import('./testrun/TestRunTab'), { ssr: false, loading: Loading });
const LearnTab = dynamic(() => import('./learn/LearnTab'), { ssr: false, loading: Loading });
const BenchTab = dynamic(() => import('./bench/BenchTab'), { ssr: false, loading: Loading });

function ProblemCount() {
  const text = useStudio(selectText);
  const { error, warning } = analyze(text).counts;
  if (error + warning === 0) return null;
  return <span className={cn('rounded px-1 font-mono text-[10px]', error > 0 ? 'bg-danger/15 text-danger' : 'bg-warn/15 text-warn')}>{error + warning}</span>;
}

/** The right column: reference docs, problems, a test run, lessons and the benchmark. */
export function StudioPanels({ className }: { className?: string }) {
  const tab = useStudio((s) => s.panel);
  return (
    <aside className={cn('flex min-h-0 flex-col bg-surface', className)} aria-label="Studio panels">
      <Tabs value={tab} onValueChange={(v) => useStudio.setState({ panel: v as PanelTab })} className="flex h-full min-h-0 flex-col">
        <TabsList className="no-scrollbar gap-0.5 overflow-x-auto">
          <TabsTrigger className="px-1.5 whitespace-nowrap" value="reference">
            <BookOpen />
            Reference
          </TabsTrigger>
          <TabsTrigger className="px-1.5 whitespace-nowrap" value="problems">
            <CircleAlert />
            Problems
            <ProblemCount />
          </TabsTrigger>
          <TabsTrigger className="px-1.5 whitespace-nowrap" value="test">
            <Play />
            Test run
          </TabsTrigger>
          <TabsTrigger className="px-1.5 whitespace-nowrap" value="learn">
            <GraduationCap />
            Learn
          </TabsTrigger>
          <TabsTrigger className="px-1.5 whitespace-nowrap" value="bench">
            <Gauge />
            Bench
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reference" className="overflow-hidden">
          <ReferenceTab />
        </TabsContent>
        <TabsContent value="problems" className="overflow-hidden">
          <ProblemsTab />
        </TabsContent>
        <TabsContent value="test" className="overflow-y-auto">
          <TestRunTab />
        </TabsContent>
        <TabsContent value="learn" className="overflow-y-auto">
          <LearnTab />
        </TabsContent>
        <TabsContent value="bench" className="overflow-y-auto">
          <BenchTab />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
