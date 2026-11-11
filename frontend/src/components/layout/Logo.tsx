import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <img src="/logo.png" alt="Cardi" className="h-20 w-auto" />
    </div>
  );
}
