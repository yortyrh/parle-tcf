'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ExamTranscriptLine } from '@/lib/transcript-from-history';
import { cn } from '@/lib/utils';

/** Initial guess only; rows are measured after paint via virtualizer.measureElement. */
const ESTIMATED_ROW_HEIGHT = 96;
const OVERSCAN = 5;
const AUTO_SCROLL_THRESHOLD_PX = 120;

interface ConversationTabContentProps {
  lines: ExamTranscriptLine[];
}

const MessageBubble = React.memo(function MessageBubble({ item }: { item: ExamTranscriptLine }) {
  const isLocal = item.isLocal;
  const label = isLocal ? 'Vous' : 'Évaluateur';

  return (
    <div className={cn('flex gap-2', isLocal ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isLocal ? 'bg-cyan-700 text-white' : 'bg-teal-600 text-white'
        )}
      >
        {label[0]}
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', isLocal && 'items-end')}>
        <span className="text-muted-foreground text-xs font-semibold">{label}</span>
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug break-words',
            isLocal
              ? 'rounded-tr-none bg-cyan-700 text-white'
              : 'rounded-tl-none bg-gray-100 text-gray-900'
          )}
        >
          {item.text}
        </div>
      </div>
    </div>
  );
});

export function ConversationTabContent({ lines }: ConversationTabContentProps) {
  const sorted = useMemo(() => [...lines].sort((a, b) => a.timestamp - b.timestamp), [lines]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const checkIfNearBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    setIsNearBottom(distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX);
  }, []);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkIfNearBottom, { passive: true });
    return () => el.removeEventListener('scroll', checkIfNearBottom);
  }, [checkIfNearBottom]);

  useEffect(() => {
    if (!isNearBottom || sorted.length === 0) return;
    virtualizer.scrollToIndex(sorted.length - 1, { align: 'end' });
  }, [sorted.length, isNearBottom, virtualizer]);

  return (
    <div ref={parentRef} className="h-full min-h-[200px] overflow-y-auto">
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = sorted[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full px-1 py-2"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <MessageBubble item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
