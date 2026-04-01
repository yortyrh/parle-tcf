'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextStreamData } from '@livekit/components-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 5;
const AUTO_SCROLL_THRESHOLD_PX = 120;

interface ConversationTabContentProps {
  transcriptions: TextStreamData[];
  localIdentity: string;
}

const MessageBubble = React.memo(function MessageBubble({
  item,
  isLocal,
}: {
  item: TextStreamData;
  isLocal: boolean;
}) {
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
            'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
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

export function ConversationTabContent({
  transcriptions,
  localIdentity,
}: ConversationTabContentProps) {
  const sorted = useMemo(
    () => [...transcriptions].sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp),
    [transcriptions]
  );

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
    if (isNearBottom && sorted.length > 0) {
      virtualizer.scrollToIndex(sorted.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [sorted.length, isNearBottom, virtualizer]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-muted-foreground text-sm">Aucune conversation pour le moment.</p>
        <p className="text-muted-foreground/70 text-xs">
          La transcription de la conversation apparaîtra ici.
        </p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto" onScroll={checkIfNearBottom}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = sorted[virtualRow.index];
          const isLocal = item.participantInfo.identity === localIdentity;

          return (
            <div
              key={item.streamInfo.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-3"
            >
              <MessageBubble item={item} isLocal={isLocal} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
