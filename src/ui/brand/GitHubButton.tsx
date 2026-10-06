import { cn } from '@/ui/cn';

export const REPO_URL = 'https://github.com/edison16a/SandboxLabML';

/** The official GitHub mark (Octicon "mark-github"), drawn at 16 px. */
export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * "View on GitHub" link styled as a quiet outline button. Compact is the
 * mark alone, a square in the same size and tone as the Settings gear it
 * sits beside in the header.
 */
export function GitHubButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-2',
        compact ? 'w-8 justify-center text-muted hover:text-fg' : 'gap-2 px-3 text-[13px] font-medium text-fg',
        className,
      )}
      aria-label="View on GitHub"
    >
      <GitHubMark />
      {!compact && <span>View on GitHub</span>}
    </a>
  );
}
