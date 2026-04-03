'use client';

import { forwardRef, useCallback, useRef } from 'react';
import { useAutoScroll } from '@/components/ui/scroll-area/hooks/useAutoScroll';
import { cn } from '@/lib/utils';

interface ScrollAreaProps {
  children?: React.ReactNode;
  className?: string;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className, children },
  ref
) {
  const scrollContentRef = useRef<HTMLDivElement>(null);

  useAutoScroll(scrollContentRef.current);

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollContentRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  return (
    <div
      ref={mergedRef}
      className={cn(
        'overflow-y-auto scroll-smooth',
        // Custom scrollbar styles
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300',
        'hover:scrollbar-thumb-gray-400',
        '[&::-webkit-scrollbar]:w-2',
        '[&::-webkit-scrollbar-track]:bg-transparent',
        '[&::-webkit-scrollbar-thumb]:bg-gray-300',
        '[&::-webkit-scrollbar-thumb]:rounded-full',
        '[&::-webkit-scrollbar-thumb]:border-2',
        '[&::-webkit-scrollbar-thumb]:border-transparent',
        'hover:[&::-webkit-scrollbar-thumb]:bg-gray-400',
        className
      )}
    >
      <div>{children}</div>
    </div>
  );
});
