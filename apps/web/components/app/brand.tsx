import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Logo mark + wordmark. The wordmark uses the display serif. */
export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 rounded-full pr-2 font-semibold', className)}
    >
      <Image
        src="/logo.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-full"
        priority
      />
      <span className="font-display text-lg tracking-tight">
        parle<span className="text-highlight">·</span>tcf
      </span>
    </Link>
  );
}
