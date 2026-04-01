'use client';

import { type ReceivedMessage } from '@livekit/components-react';
import { ShimmerText } from '@/components/livekit/shimmer-text';
import { cn } from '@/lib/utils';

interface PreConnectMessageProps {
  messages?: ReceivedMessage[];
  className?: string;
}

export function PreConnectMessage({ className, messages = [] }: PreConnectMessageProps) {
  if (messages.length > 0) return null;

  return (
    <p
      aria-hidden={messages.length > 0}
      className={cn('pointer-events-none text-center', className)}
    >
      <ShimmerText className="text-sm font-semibold">
        L&apos;agent écoute, posez-lui une question
      </ShimmerText>
    </p>
  );
}
