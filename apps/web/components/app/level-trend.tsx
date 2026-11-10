import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
} from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

const TREND = {
  up: { Icon: ArrowUpRightIcon, label: 'en progrès', className: 'text-success' },
  down: { Icon: ArrowDownRightIcon, label: 'en baisse', className: 'text-destructive' },
  flat: { Icon: ArrowRightIcon, label: 'stable', className: 'text-muted-foreground' },
} as const;

/** Arrow + words (never color alone) for the latest level against the previous ones. */
export function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' | null }) {
  if (!trend) return null;
  const { Icon, label, className } = TREND[trend];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', className)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
