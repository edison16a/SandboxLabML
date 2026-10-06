'use client';

import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { useConfirm } from '../state/confirm';

/** Renders whatever `ask()` is waiting on. Mounted once by the Studio. */
export function ConfirmDialog() {
  const request = useConfirm((s) => s.request);
  const answer = useConfirm((s) => s.answer);
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && answer('cancel')}
      title={request?.title ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={() => answer('cancel')}>
            Cancel
          </Button>
          {request?.alternateLabel && (
            <Button variant="outline" onClick={() => answer('alternate')}>
              {request.alternateLabel}
            </Button>
          )}
          <Button variant={request?.danger ? 'danger' : 'primary'} onClick={() => answer('confirm')}>
            {request?.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">{request?.body}</p>
    </Dialog>
  );
}
