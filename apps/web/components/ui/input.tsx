import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-input bg-background placeholder:text-muted-foreground shadow-xs h-10 w-full min-w-0 rounded-md border px-3 py-2 text-sm outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className
      )}
      {...props}
    />
  );
}

export { Input };
