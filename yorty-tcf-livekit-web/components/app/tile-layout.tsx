import React from 'react';
import { BarVisualizer, useVoiceAssistant } from '@livekit/components-react';
import { cn } from '@/lib/utils';

export function TileLayout() {
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();

  return (
    <div className="flex items-center justify-center">
      {/* Audio Agent Visualizer - Compact for card header */}
      <div
        className={cn(
          'bg-background aspect-square rounded-md border transition-all duration-500',
          'border-input/50 h-[80px] w-[80px] drop-shadow-lg'
        )}
      >
        <BarVisualizer
          barCount={5}
          state={agentState}
          options={{ minHeight: 5 }}
          trackRef={agentAudioTrack}
          className={cn('flex h-full items-center justify-center gap-1')}
        >
          <span
            className={cn([
              'bg-muted min-h-2.5 w-2.5 rounded-full',
              'origin-center transition-colors duration-250 ease-linear',
              'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
            ])}
          />
        </BarVisualizer>
      </div>
    </div>
  );
}
