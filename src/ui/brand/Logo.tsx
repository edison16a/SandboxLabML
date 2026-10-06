import { cn } from '@/ui/cn';

interface LogoMarkProps {
  size?: number;
  /** Pulse the orange atom once on mount. Only the landing page uses this. */
  pulse?: boolean;
  className?: string;
}

/**
 * The SandboxLab mark: one bent molecule with three atoms. Blue matches
 * positive weights in the network graph and orange matches negative ones.
 * Bonds are 2 units wide so the mark still reads at 16 px.
 */
export function LogoMark({ size = 28, pulse = false, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 20 L14 8 L22 20" stroke="#4C9AFF" strokeWidth="2" />
      <circle cx="6" cy="20" r="3" fill="#4C9AFF" />
      <circle cx="22" cy="20" r="3" fill="#4C9AFF" />
      <circle
        cx="14"
        cy="8"
        r="3.5"
        fill="#FF9F43"
        className={cn(pulse && 'animate-pulse-once')}
        style={pulse ? { transformOrigin: '14px 8px', transformBox: 'view-box' } : undefined}
      />
    </svg>
  );
}

/** Mark plus the "SandboxLab" + "ML" wordmark used in the header. `wordmarkClassName` lets a tight header drop the words. */
export function Logo({ pulse = false, wordmarkClassName }: { pulse?: boolean; wordmarkClassName?: string }) {
  return (
    <span className="flex items-center gap-2 select-none">
      <LogoMark pulse={pulse} />
      <span className={cn('text-[15px] font-semibold tracking-tight text-fg', wordmarkClassName)}>
        SandboxLab<span className="text-accent">ML</span>
      </span>
    </span>
  );
}
