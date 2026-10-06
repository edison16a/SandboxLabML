'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/ui/cn';
import { useToasts, type ToastTone } from './toastStore';

const icons: Record<ToastTone, React.ReactNode> = {
  info: <Info className="size-4 text-accent" />,
  success: <CircleCheck className="size-4 text-success" />,
  error: <CircleAlert className="size-4 text-danger" />,
};

/** Renders the toast queue in the bottom right corner. Mounted once in Providers. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex animate-pop-in items-start gap-2.5 rounded-lg border bg-surface-2 p-3 shadow-xl shadow-black/40',
            t.tone === 'error' ? 'border-danger/40' : 'border-border-strong',
          )}
        >
          <span className="mt-0.5">{icons[t.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{t.title}</p>
            {t.description && <p className="mt-0.5 text-[12px] break-words text-muted">{t.description}</p>}
            {t.action && (
              <button
                className="mt-2 text-[12px] font-semibold text-accent hover:underline"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
