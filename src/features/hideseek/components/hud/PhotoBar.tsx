'use client';

import { Download, X } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { toast } from '@/ui/toast/toastStore';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { glass } from './ViewControls';

/** Saves what the 3D canvas shows right now as a PNG. The canvas keeps its drawing buffer, so this works between frames. */
function savePng(viewport: HTMLElement | null): void {
  const canvas = viewport?.querySelector('canvas');
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return toast.error('Could not save the image');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hide-and-seek-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * Photo mode: every other control is hidden, depth of field focuses on the
 * arena and this small bar offers to save the frame.
 */
export function PhotoBar({ viewport }: { viewport: React.RefObject<HTMLDivElement | null> }) {
  const photo = useHideSeekLab((s) => s.photoMode);
  const effects = useHideSeekLab((s) => s.effects);
  const tier = useHideSeekLab((s) => s.activeTier);
  const set = useHideSeekLab((s) => s.set);
  if (!photo) return null;
  const dof = effects && (tier === 'high' || tier === 'ultra');
  return (
    <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-black/55 p-1.5 pl-3 text-white backdrop-blur-md">
      <span className="text-[12px] text-white/80">{dof ? 'Photo mode' : 'Photo mode. Depth of field needs High quality and effects on.'}</span>
      <Button size="sm" variant="primary" onClick={() => savePng(viewport.current)}>
        <Download />
        Save PNG
      </Button>
      <Button size="icon-sm" variant="secondary" className={glass} onClick={() => set({ photoMode: false })} aria-label="Leave photo mode">
        <X />
      </Button>
    </div>
  );
}
