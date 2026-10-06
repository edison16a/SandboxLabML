'use client';

import { Activity, Boxes, Network, ScanEye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/Tabs';
import { useRacingLab, type PanelTab } from '../state/labStore';
import { ProgressTab } from './ProgressTab';

/** Right-hand panel: progress charts, the network, live inputs and the model card. */
export function SidePanel({ network, inputs, model }: { network: React.ReactNode; inputs: React.ReactNode; model: React.ReactNode }) {
  const tab = useRacingLab((s) => s.panelTab);
  const set = useRacingLab((s) => s.set);
  return (
    <Tabs value={tab} onValueChange={(v) => set({ panelTab: v as PanelTab })} className="flex h-full min-h-0 flex-col">
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
        {network}
      </TabsContent>
      <TabsContent value="inputs" className="overflow-y-auto">
        {inputs}
      </TabsContent>
      <TabsContent value="model" className="overflow-y-auto">
        {model}
      </TabsContent>
    </Tabs>
  );
}
