'use client';

import { Activity, Boxes, Network, ScanEye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { useLab, useLabSet } from '../LabContext';
import type { PanelTab } from '../state/labState';
import { InputsTab } from './InputsTab';
import { ModelTab } from './ModelTab';
import { NetworkTab } from './NetworkTab';
import { ProgressTab } from './ProgressTab';

interface Props {
  /** Replaces a tab's content, for a lab that shows more than the shared one. */
  network?: React.ReactNode;
  inputs?: React.ReactNode;
  model?: React.ReactNode;
}

/** Right hand panel: progress charts, the network, live inputs and the model card. */
export function SidePanel({ network, inputs, model }: Props) {
  const tab = useLab((s) => s.panelTab);
  const set = useLabSet();
  return (
    <Tabs value={tab} onValueChange={(v) => set({ panelTab: v as PanelTab })} className="flex h-full min-h-0 flex-col">
      <TabsList>
        <TabsTrigger value="progress">
          <Activity />
          Progress
        </TabsTrigger>
        <TabsTrigger value="network" data-tour="tab-network">
          <Network />
          Network
        </TabsTrigger>
        <TabsTrigger value="inputs">
          <ScanEye />
          Inputs
        </TabsTrigger>
        <TabsTrigger value="model">
          <Boxes />
          Model
        </TabsTrigger>
      </TabsList>
      <TabsContent value="progress" className="overflow-y-auto">
        <ProgressTab />
      </TabsContent>
      <TabsContent value="network" className="flex flex-col overflow-hidden">
        {network ?? <NetworkTab />}
      </TabsContent>
      <TabsContent value="inputs" className="overflow-y-auto">
        {inputs ?? <InputsTab />}
      </TabsContent>
      <TabsContent value="model" className="overflow-y-auto">
        {model ?? <ModelTab />}
      </TabsContent>
    </Tabs>
  );
}
