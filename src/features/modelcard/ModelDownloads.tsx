'use client';

import { Download, FileArchive } from 'lucide-react';
import { downloadJson, exportRun, runFileName } from '@/storage/exportImport';
import { Button } from '@/ui/primitives/Button';
import { toast } from '@/ui/toast/toastStore';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { modelFile, modelFileName, type ModelSource } from './modelFile';

/**
 * Two downloads under the model card: the champion brain on its own, as a
 * readable JSON network, and the whole run, which imports back into the
 * app on the Runs page.
 */
export function ModelDownloads({ source }: { source: ModelSource }) {
  const saveModel = () => {
    downloadJson(modelFileName(source.run.name, source.generation, source.team), modelFile(source));
    toast.success('Model downloaded');
  };
  const saveRun = async () => {
    try {
      downloadJson(runFileName(source.run.name), await exportRun(source.run.id));
      toast.success('Run downloaded');
    } catch (err) {
      toast.error('Could not download the run', err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <Tooltip content="The champion brain as JSON: neurons, links and weights, with input and output names">
        <Button size="sm" variant="primary" onClick={saveModel}>
          <Download />
          Download model
        </Button>
      </Tooltip>
      <Tooltip content="Every generation and the latest checkpoint. Import it on the Runs page.">
        <Button size="sm" variant="outline" onClick={() => void saveRun()}>
          <FileArchive />
          Download run
        </Button>
      </Tooltip>
      <span className="text-[11px] text-subtle">Generation {source.generation + 1}</span>
    </div>
  );
}
