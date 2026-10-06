import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/ui/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-[#06101f] hover:bg-[#62a8ff] active:bg-accent-strong font-semibold',
  secondary: 'bg-surface-3 text-fg hover:bg-[#232a37] border border-border',
  outline: 'border border-border bg-transparent text-fg hover:bg-surface-2 hover:border-border-strong',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/90 text-white hover:bg-danger font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5',
  md: 'h-8 px-3 text-[13px] gap-2',
  lg: 'h-10 px-4 text-[14px] gap-2',
  icon: 'h-8 w-8 justify-center',
  'icon-sm': 'h-7 w-7 justify-center',
};

/** The one button used across the app. Variants map to intent, not color. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
