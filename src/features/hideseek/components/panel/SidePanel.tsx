'use client';

import { Activity, Boxes, Network, ScanEye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { useHideSeekLab } from '../../state/hideSeekStore';
import type { HsPanelTab } from '../../state/types';
import { InputsTab } from './InputsTab';
import { ModelTab } from './ModelTab';
import { NetworkTab } from './NetworkTab';
import { ProgressTab } from './ProgressTab';

/** Right-hand panel: progress charts, a champion's network, live inputs and the model card. */
export function SidePanel() {
  const tab = useHideSeekLab((s) => s.panelTab);
  const set = useHideSeekLab((s) => s.set);
  return (
    <Tabs value={tab} onValueChange={(v) => set({ panelTab: v as HsPanelTab })} className="flex h-full min-h-0 flex-col">
      <TabsList>
        <TabsTrigger value="progress">
          <Activity />
          Progress
        </TabsTrigger>
        <TabsTrigger value="network">
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
        <NetworkTab />
      </TabsContent>
      <TabsContent value="inputs" className="overflow-y-auto">
        <InputsTab />
      </TabsContent>
      <TabsContent value="model" className="overflow-y-auto">
        <ModelTab />
      </TabsContent>
    </Tabs>
  );
}
