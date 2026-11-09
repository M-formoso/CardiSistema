import { cn } from '@/lib/utils';

export function Logo({
  className,
  variant = 'full',
}: {
  className?: string;
  /** `full`: logo + wordmark "Cardi" · `mark`: solo el símbolo. */
  variant?: 'full' | 'mark';
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src="/logo.png" alt="Cardi" className="h-8 w-auto" />
      {variant === 'full' && (
        <span className="text-lg font-bold tracking-tight text-primary">Cardi</span>
      )}
    </div>
  );
}
