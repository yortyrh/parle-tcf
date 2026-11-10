import { WarningCircleIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Nothing to show yet: what this place is for and the next step. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center',
        className
      )}
    >
      <p className="font-display text-title">{title}</p>
      {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A request failed: the message, and a retry when it makes sense. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-xl border p-4 text-sm',
        className
      )}
    >
      <WarningCircleIcon className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-2">
        <p>{message}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" className="w-fit" onClick={onRetry}>
            Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
