'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ExamTranscriptLine } from '@/lib/transcript-from-history';
import { cn } from '@/lib/utils';

const ReactMarkdown = React.lazy(() => import('react-markdown'));
const remarkGfm = import('remark-gfm').then((m) => m.default);
let _remarkGfm: typeof import('remark-gfm').default | null = null;
void remarkGfm.then((mod) => {
  _remarkGfm = mod;
});

/** Initial guess only; rows are measured after paint via virtualizer.measureElement. */
const ESTIMATED_ROW_HEIGHT = 96;
const OVERSCAN = 5;
const AUTO_SCROLL_THRESHOLD_PX = 120;

interface ConversationTabContentProps {
  lines: ExamTranscriptLine[];
}

const EvaluatorMarkdownBody = React.memo(function EvaluatorMarkdownBody({
  content,
}: {
  content: string;
}) {
  const plugins = useMemo(() => (_remarkGfm ? [_remarkGfm] : []), []);
  if (!content) {
    return (
      <span className="text-muted-foreground text-xs tabular-nums" aria-hidden>
        …
      </span>
    );
  }
  return (
    <React.Suspense
      fallback={<span className="text-muted-foreground animate-pulse text-xs">…</span>}
    >
      <div
        className={cn(
          'prose prose-sm dark:prose-invert prose-p:my-1 prose-p:text-inherit prose-headings:text-inherit',
          'prose-p:leading-snug prose-headings:my-1.5 prose-headings:text-sm prose-ul:my-1 prose-li:my-0',
          'prose-strong:text-inherit prose-strong:font-semibold max-w-none text-sm'
        )}
      >
        <ReactMarkdown remarkPlugins={plugins}>{content}</ReactMarkdown>
      </div>
    </React.Suspense>
  );
});

const MessageBubble = React.memo(function MessageBubble({ item }: { item: ExamTranscriptLine }) {
  const isLocal = item.isLocal;
  const label = isLocal ? 'Vous' : 'Évaluateur';

  return (
    <div className={cn('flex gap-2', isLocal ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isLocal ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
        )}
      >
        {label[0]}
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', isLocal && 'items-end')}>
        <span className="text-muted-foreground text-xs font-semibold">{label}</span>
        <div
          className={cn(
            'max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm leading-snug',
            isLocal
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-muted text-foreground rounded-tl-none'
          )}
        >
          {isLocal ? item.text : <EvaluatorMarkdownBody content={item.text} />}
        </div>
      </div>
    </div>
  );
});

export function ConversationTabContent({ lines }: ConversationTabContentProps) {
  const sorted = useMemo(() => [...lines].sort((a, b) => a.timestamp - b.timestamp), [lines]);

  const lastLineCharCount = sorted.length > 0 ? sorted[sorted.length - 1].text.length : 0;

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
  }, [sorted.length, lastLineCharCount, isNearBottom, virtualizer]);

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
              className="absolute left-0 top-0 w-full px-1 py-2"
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
