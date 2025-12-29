import React from 'react';
import { BarVisualizer, useVoiceAssistant } from '@livekit/components-react';
import { cn } from '@/lib/utils';

export function TileLayout() {
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();

  return (
    <div className="flex items-center justify-center">
      {/* Audio Agent Visualizer - Compact for card header, smaller on mobile */}
      <div
        className={cn(
          'bg-background aspect-square rounded-md border transition-all duration-500',
          'border-input/50 h-14 w-14 drop-shadow-lg sm:h-[80px] sm:w-[80px]'
        )}
      >
        <BarVisualizer
          barCount={5}
          state={agentState}
          options={{ minHeight: 5 }}
          trackRef={agentAudioTrack}
          className={cn('flex h-full items-center justify-center gap-0.5 sm:gap-1')}
        >
          <span
            className={cn([
              'bg-muted min-h-2 w-2 rounded-full sm:min-h-2.5 sm:w-2.5',
              'origin-center transition-colors duration-250 ease-linear',
              'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
            ])}
          />
        </BarVisualizer>
      </div>
    </div>
  );
}
